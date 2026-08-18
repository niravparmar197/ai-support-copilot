import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Impersonation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = 'correct-horse-battery-staple';
  const SUPER_ADMIN_EMAIL = 'impersonation-e2e-super-admin@example.com';
  const COMPANY_ADMIN_EMAIL = 'impersonation-e2e-company-admin@example.com';
  const OTHER_STAFF_EMAIL = 'impersonation-e2e-other-staff@example.com';

  let tenantId: string;
  let suspendedTenantId: string;
  let superAdminId: string;
  let companyAdminId: string;
  let otherStaffId: string;

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
      where: {
        user: {
          email: {
            in: [SUPER_ADMIN_EMAIL, COMPANY_ADMIN_EMAIL, OTHER_STAFF_EMAIL],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [SUPER_ADMIN_EMAIL, COMPANY_ADMIN_EMAIL, OTHER_STAFF_EMAIL],
        },
      },
    });
    await prisma.tenant.deleteMany({
      where: {
        name: {
          in: [
            'Impersonation E2E Test Tenant',
            'Impersonation E2E Suspended Tenant',
          ],
        },
      },
    });

    const tenant = await prisma.tenant.create({
      data: { name: 'Impersonation E2E Test Tenant', status: 'ACTIVE' },
    });
    tenantId = tenant.id;

    const suspendedTenant = await prisma.tenant.create({
      data: { name: 'Impersonation E2E Suspended Tenant', status: 'SUSPENDED' },
    });
    suspendedTenantId = suspendedTenant.id;

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

    // Non-SUPER_ADMIN caller, for the 403 test.
    const otherStaff = await prisma.user.create({
      data: {
        tenantId,
        email: OTHER_STAFF_EMAIL,
        passwordHash,
        role: 'SUPPORT_USER',
        status: 'ACTIVE',
      },
    });
    otherStaffId = otherStaff.id;
  });

  afterAll(async () => {
    await prisma.userSession.deleteMany({
      where: { userId: { in: [superAdminId, companyAdminId, otherStaffId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminId, companyAdminId, otherStaffId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, suspendedTenantId] } },
    });
    await app.close();
  });

  function extractCookies(response: request.Response): string[] {
    const cookies = response.headers['set-cookie'];
    if (!cookies) return [];
    return Array.isArray(cookies) ? cookies : [cookies];
  }

  async function loginAsSuperAdmin(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SUPER_ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    return extractCookies(response).join('; ');
  }

  it('SUPER_ADMIN can impersonate a company admin; /auth/me reports impersonatedBy', async () => {
    const superAdminCookies = await loginAsSuperAdmin();

    const impersonateResponse = await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${tenantId}/impersonate`)
      .set('Cookie', superAdminCookies)
      .expect(201);
    expect(impersonateResponse.body).toEqual({ status: 'ok' });

    const impersonationCookies = extractCookies(impersonateResponse).join('; ');

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', impersonationCookies)
      .expect(200);

    expect(meResponse.body.id).toBe(companyAdminId);
    expect(meResponse.body.role).toBe('COMPANY_ADMIN');
    expect(meResponse.body.impersonatedBy).toMatchObject({
      userId: superAdminId,
      companyId: tenantId,
      companyName: 'Impersonation E2E Test Tenant',
    });

    // The SUPER_ADMIN's pre-impersonation session was revoked server-side
    // the moment impersonation started (D-026). Its access token stays
    // cryptographically valid until its own 15-minute expiry — session
    // revocation alone never invalidates an in-hand access token, only the
    // *next* refresh (same behavior JwtStrategy documents for the tenant
    // suspend flow) — so what actually proves the session was revoked is
    // that it can no longer be rotated.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', superAdminCookies)
      .expect(401);

    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId, action: 'company.impersonation.started' },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].actorId).toBe(superAdminId);
    expect(auditLogs[0].targetId).toBe(companyAdminId);
  });

  it('a non-impersonated user calling stop-impersonation gets 400', async () => {
    // Fresh login as the company admin directly (not via impersonation) —
    // this token carries no impersonatorId claim.
    const directLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: COMPANY_ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    const directCookies = extractCookies(directLogin).join('; ');

    await request(app.getHttpServer())
      .post('/api/v1/auth/stop-impersonation')
      .set('Cookie', directCookies)
      .expect(400);
  });

  it('stop-impersonation restores the SUPER_ADMIN and returns the companyId', async () => {
    const superAdminCookies = await loginAsSuperAdmin();

    const impersonateResponse = await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${tenantId}/impersonate`)
      .set('Cookie', superAdminCookies)
      .expect(201);
    const impersonationCookies = extractCookies(impersonateResponse).join('; ');

    const stopResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/stop-impersonation')
      .set('Cookie', impersonationCookies)
      .expect(200);
    expect(stopResponse.body).toEqual({ companyId: tenantId });

    const restoredCookies = extractCookies(stopResponse).join('; ');

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', restoredCookies)
      .expect(200);
    expect(meResponse.body.id).toBe(superAdminId);
    expect(meResponse.body.role).toBe('SUPER_ADMIN');
    expect(meResponse.body.impersonatedBy).toBeNull();

    // The impersonation session itself is now revoked too — same
    // "can't be rotated anymore" proof as above, not an immediate
    // access-token invalidation.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', impersonationCookies)
      .expect(401);

    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId, action: 'company.impersonation.stopped' },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].actorId).toBe(superAdminId);
    expect(auditLogs[0].targetId).toBe(companyAdminId);
  });

  it('non-SUPER_ADMIN -> 403 on impersonate', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: OTHER_STAFF_EMAIL, password: PASSWORD })
      .expect(200);
    const cookies = extractCookies(loginResponse).join('; ');

    await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${tenantId}/impersonate`)
      .set('Cookie', cookies)
      .expect(403);
  });

  // Combined into one test (one login) — POST /auth/login is throttled to
  // 5/min (auth.controller.ts), and this suite is already close to that
  // limit across its other cases.
  it('cannot impersonate a suspended (409) or nonexistent (404) company', async () => {
    const superAdminCookies = await loginAsSuperAdmin();

    await request(app.getHttpServer())
      .post(`/api/v1/platform/companies/${suspendedTenantId}/impersonate`)
      .set('Cookie', superAdminCookies)
      .expect(409);

    await request(app.getHttpServer())
      .post('/api/v1/platform/companies/does-not-exist/impersonate')
      .set('Cookie', superAdminCookies)
      .expect(404);
  });
});
