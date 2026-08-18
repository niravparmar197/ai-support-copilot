import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Company creation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = 'correct-horse-battery-staple';
  const SUPER_ADMIN_EMAIL = 'companies-e2e-super-admin@example.com';
  const COMPANY_ADMIN_EMAIL = 'companies-e2e-company-admin@example.com';

  let tenantId: string;
  let superAdminId: string;
  let companyAdminId: string;
  let superAdminCookies: string;

  // Tracks every tenant/name this file creates via the API, so afterAll can
  // clean up completely regardless of which tests ran.
  const createdCompanyNames: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    // Sessions before users — same FK-ordering reasoning as afterAll below.
    await prisma.userSession.deleteMany({
      where: {
        user: { email: { in: [SUPER_ADMIN_EMAIL, COMPANY_ADMIN_EMAIL] } },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [SUPER_ADMIN_EMAIL, COMPANY_ADMIN_EMAIL] } },
    });
    await prisma.tenant.deleteMany({
      where: { name: 'Companies E2E Test Tenant' },
    });

    const tenant = await prisma.tenant.create({
      data: { name: 'Companies E2E Test Tenant', status: 'ACTIVE' },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    superAdminId = superAdmin.id;

    const companyAdmin = await prisma.user.create({
      data: {
        tenantId,
        email: COMPANY_ADMIN_EMAIL,
        passwordHash,
        role: 'COMPANY_ADMIN',
        status: 'ACTIVE',
      },
    });
    companyAdminId = companyAdmin.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SUPER_ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    superAdminCookies = extractCookies(loginResponse).join('; ');
  });

  afterAll(async () => {
    const createdTenants = await prisma.tenant.findMany({
      where: { name: { in: createdCompanyNames } },
      select: { id: true },
    });
    const createdTenantIds = createdTenants.map((t) => t.id);

    await prisma.auditLog.deleteMany({
      where: { tenantId: { in: [...createdTenantIds, tenantId] } },
    });
    // Sessions before users — user_sessions_user_id_fkey is ON DELETE
    // RESTRICT, so a user with an active session can't be deleted first.
    // superAdminId is included explicitly since its tenantId is null (see
    // D-008) and so isn't covered by the tenantId-based filter below.
    await prisma.userSession.deleteMany({
      where: {
        OR: [
          { user: { tenantId: { in: [...createdTenantIds, tenantId] } } },
          { userId: superAdminId },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [...createdTenantIds, tenantId] } },
    });
    await prisma.user.deleteMany({
      where: { id: superAdminId },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [...createdTenantIds, tenantId] } },
    });
    await app.close();
  });

  function extractCookies(response: request.Response): string[] {
    const cookies = response.headers['set-cookie'];
    if (!cookies) return [];
    return Array.isArray(cookies) ? cookies : [cookies];
  }

  function createCompanyPayload(suffix: string) {
    return {
      companyName: `Acme ${suffix}`,
      adminName: `Admin ${suffix}`,
      adminEmail: `admin-${suffix}@example.com`,
      temporaryPassword: 'temporary-password-123',
    };
  }

  it('creates exactly one Tenant and one User in a single transaction, plus an audit log row', async () => {
    const payload = createCompanyPayload('create-test');
    createdCompanyNames.push(payload.companyName);

    const response = await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set('Cookie', superAdminCookies)
      .send(payload)
      .expect(201);

    expect(response.body.tenant.name).toBe(payload.companyName);
    expect(response.body.admin.email).toBe(payload.adminEmail);
    expect(response.body.admin).not.toHaveProperty('passwordHash');

    const tenants = await prisma.tenant.findMany({
      where: { name: payload.companyName },
    });
    expect(tenants).toHaveLength(1);

    const users = await prisma.user.findMany({
      where: { tenantId: tenants[0].id },
    });
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(payload.adminEmail);
    expect(users[0].role).toBe('COMPANY_ADMIN');
    expect(users[0].mustResetPassword).toBe(true);

    const auditLogs = await prisma.auditLog.findMany({
      where: { targetType: 'tenant', targetId: tenants[0].id },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('company.created');
    expect(auditLogs[0].actorId).toBe(superAdminId);
    expect(auditLogs[0].metadata).toMatchObject({
      companyName: payload.companyName,
      adminEmail: payload.adminEmail,
    });
  });

  it('PATCH /:id updates companyName only and logs company.updated', async () => {
    const payload = createCompanyPayload('update-test');
    createdCompanyNames.push(payload.companyName);
    createdCompanyNames.push(`${payload.companyName} Renamed`);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set('Cookie', superAdminCookies)
      .send(payload)
      .expect(201);
    const companyId = createResponse.body.tenant.id;

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/platform/companies/${companyId}`)
      .set('Cookie', superAdminCookies)
      .send({ companyName: `${payload.companyName} Renamed` })
      .expect(200);

    expect(updateResponse.body.name).toBe(`${payload.companyName} Renamed`);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        targetType: 'tenant',
        targetId: companyId,
        action: { not: 'company.created' },
      },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('company.updated');
    expect(auditLogs[0].metadata).toMatchObject({
      name: { from: payload.companyName, to: `${payload.companyName} Renamed` },
    });
  });

  // The task described this as "whitelist strips it" (implying a 200 with
  // status silently ignored) — but this app's global ValidationPipe has
  // BOTH whitelist AND forbidNonWhitelisted enabled (D-004), and per
  // NestJS's own documented behavior, forbidNonWhitelisted makes the pipe
  // *reject* the request when it contains an unrecognized property, rather
  // than stripping it and proceeding. So the actual, stronger guarantee is
  // 400 (the whole request is refused), not 200-with-status-ignored. Either
  // way status can never reach the service, which is the property that
  // actually matters — this just tests the real mechanism, not the one the
  // task assumed.
  it('PATCH /:id rejects a status field in the body (400, forbidNonWhitelisted) — it never reaches the service', async () => {
    const payload = createCompanyPayload('edit-no-status-test');
    createdCompanyNames.push(payload.companyName);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set('Cookie', superAdminCookies)
      .send(payload)
      .expect(201);
    const companyId = createResponse.body.tenant.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/platform/companies/${companyId}`)
      .set('Cookie', superAdminCookies)
      .send({ companyName: payload.companyName, status: 'SUSPENDED' })
      .expect(400);

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: companyId },
    });
    expect(tenant.status).toBe('ACTIVE');
  });

  it('COMPANY_ADMIN -> 403', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: COMPANY_ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    const companyAdminCookies = extractCookies(loginResponse).join('; ');

    await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set('Cookie', companyAdminCookies)
      .send(createCompanyPayload('forbidden-test'))
      .expect(403);
  });

  it('COMPANY_ADMIN -> 403 on get/update/suspend/activate', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: COMPANY_ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    const companyAdminCookies = extractCookies(loginResponse).join('; ');

    await request(app.getHttpServer())
      .get(`/api/v1/platform/companies/${tenantId}`)
      .set('Cookie', companyAdminCookies)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/platform/companies/${tenantId}`)
      .set('Cookie', companyAdminCookies)
      .send({ companyName: 'Should Not Apply' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/platform/companies/${tenantId}/suspend`)
      .set('Cookie', companyAdminCookies)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/platform/companies/${tenantId}/activate`)
      .set('Cookie', companyAdminCookies)
      .expect(403);
  });

  it('no token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .send(createCompanyPayload('unauth-test'))
      .expect(401);
  });

  // D-009 means (tenantId, email) uniqueness can never actually collide
  // through this endpoint — every request creates a brand-new tenant, so
  // there's no way to reach a *genuine* duplicate-email constraint failure
  // via the real API the way the task described. What actually matters —
  // that ANY mid-transaction failure rolls back the tenant, leaving no
  // orphaned zero-user tenant — is tested directly by forcing the User
  // creation step to fail.
  it('a mid-transaction failure rolls back the tenant (no orphaned zero-user tenant)', async () => {
    const payload = createCompanyPayload('rollback-test');

    // Spying on prisma.user.create directly does NOT intercept this: the
    // transaction callback receives its own transaction-scoped client
    // (`tx`), which is not the same object/method reference as the
    // top-level `prisma.user.create` — confirmed by trying exactly that
    // first and watching the request succeed anyway. To force a *real*
    // mid-transaction failure (and therefore a genuine Postgres ROLLBACK,
    // not a simulated one), this wraps the real $transaction and mutates
    // the actual `tx.user.create` the service's callback will call.
    const originalTransaction = prisma.$transaction.bind(prisma);
    const transactionSpy = jest
      .spyOn(prisma, '$transaction')
      .mockImplementationOnce(((callback: (tx: unknown) => unknown) =>
        originalTransaction((tx: typeof prisma) => {
          tx.user.create = () =>
            Promise.reject(new Error('simulated failure'));
          return callback(tx);
        })) as typeof prisma.$transaction);

    await request(app.getHttpServer())
      .post('/api/v1/platform/companies')
      .set('Cookie', superAdminCookies)
      .send(payload)
      .expect(500);

    transactionSpy.mockRestore();

    const orphanedTenant = await prisma.tenant.findFirst({
      where: { name: payload.companyName },
    });
    expect(orphanedTenant).toBeNull();
  });
});

// Separate top-level suite with its own app instance, tenant, and users —
// suspending a tenant is destructive to that tenant's ability to log in,
// so this can't share the fixture tenant/company-admin used by the main
// suite above without breaking its other tests. Order within this block is
// deliberate (suspend -> suspend again -> login blocked -> activate),
// building on state left by the previous test, same pattern used for the
// session-rotation suite in auth.e2e-spec.ts.
describe('Company suspend/activate lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = 'correct-horse-battery-staple';
  const SUPER_ADMIN_EMAIL = 'companies-lifecycle-super-admin@example.com';
  const STAFF_EMAIL = 'companies-lifecycle-staff@example.com';

  let tenantId: string;
  let superAdminId: string;
  let staffUserId: string;
  let superAdminCookies: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.userSession.deleteMany({
      where: { user: { email: { in: [SUPER_ADMIN_EMAIL, STAFF_EMAIL] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [SUPER_ADMIN_EMAIL, STAFF_EMAIL] } },
    });
    await prisma.tenant.deleteMany({
      where: { name: 'Lifecycle E2E Test Tenant' },
    });

    const tenant = await prisma.tenant.create({
      data: { name: 'Lifecycle E2E Test Tenant', status: 'ACTIVE' },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    superAdminId = superAdmin.id;

    const staffUser = await prisma.user.create({
      data: {
        tenantId,
        email: STAFF_EMAIL,
        passwordHash,
        role: 'SUPPORT_USER',
        status: 'ACTIVE',
      },
    });
    staffUserId = staffUser.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SUPER_ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    superAdminCookies = extractCookies(loginResponse).join('; ');
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.userSession.deleteMany({
      where: { userId: { in: [staffUserId, superAdminId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [staffUserId, superAdminId] } },
    });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  function extractCookies(response: request.Response): string[] {
    const cookies = response.headers['set-cookie'];
    if (!cookies) return [];
    return Array.isArray(cookies) ? cookies : [cookies];
  }

  it('suspend sets status, revokes sessions, and blocks the now-revoked token', async () => {
    // Staff logs in first, so there's an active session/access token to
    // revoke and to prove gets rejected afterward.
    const staffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: STAFF_EMAIL, password: PASSWORD })
      .expect(200);
    const staffCookies = extractCookies(staffLogin).join('; ');

    // Confirm the token works before suspension, so the 401 after actually
    // proves something changed.
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', staffCookies)
      .expect(200);

    const suspendResponse = await request(app.getHttpServer())
      .patch(`/api/v1/platform/companies/${tenantId}/suspend`)
      .set('Cookie', superAdminCookies)
      .expect(200);
    expect(suspendResponse.body.status).toBe('SUSPENDED');

    const sessions = await prisma.userSession.findMany({
      where: { userId: staffUserId },
    });
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(
      true,
    );

    // The access token itself is still cryptographically valid (not
    // expired) — it's rejected by the live tenant-status check in
    // JwtStrategy.validate(), not by the session revocation above. That
    // revocation alone would NOT have blocked this request; see Q6.
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', staffCookies)
      .expect(401);

    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId, action: 'company.suspended' },
    });
    expect(auditLogs).toHaveLength(1);
  });

  it('suspending an already-suspended tenant is idempotent (200, no duplicate audit log)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/platform/companies/${tenantId}/suspend`)
      .set('Cookie', superAdminCookies)
      .expect(200);

    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId, action: 'company.suspended' },
    });
    // Still just the one entry from the previous test — this call was a
    // no-op, not a second logged transition.
    expect(auditLogs).toHaveLength(1);
  });

  it('login for a user in a suspended tenant returns 401 with the generic message', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: STAFF_EMAIL, password: PASSWORD })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('activate reverses status and restores login', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/platform/companies/${tenantId}/activate`)
      .set('Cookie', superAdminCookies)
      .expect(200);

    expect(response.body.status).toBe('ACTIVE');

    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId, action: 'company.activated' },
    });
    expect(auditLogs).toHaveLength(1);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: STAFF_EMAIL, password: PASSWORD })
      .expect(200);
  });
});
