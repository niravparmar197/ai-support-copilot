import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

// Counts are asserted as deltas against a baseline captured before this
// suite's fixtures are created, not as absolute totals — other e2e spec
// files seed their own tenants/users against the same real Postgres
// instance (D-002), and Jest can run spec files concurrently, so an
// absolute-total assertion would be flaky by construction.
describe('Platform dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = 'correct-horse-battery-staple';
  const SUPER_ADMIN_EMAIL = 'dashboard-e2e-super-admin@example.com';
  const COMPANY_ADMIN_EMAIL = 'dashboard-e2e-company-admin@example.com';
  const ACTIVE_ADMIN_1_EMAIL = 'dashboard-e2e-active-admin-1@example.com';
  const ACTIVE_ADMIN_2_EMAIL = 'dashboard-e2e-active-admin-2@example.com';
  const SUSPENDED_ADMIN_EMAIL = 'dashboard-e2e-suspended-admin@example.com';

  const TENANT_NAMES = [
    'Dashboard E2E Active Tenant 1',
    'Dashboard E2E Active Tenant 2',
    'Dashboard E2E Suspended Tenant',
  ];

  let superAdminId: string;
  let superAdminCookies: string;
  let companyAdminCookies: string;
  let fixtureUserIds: string[];
  let fixtureTenantIds: string[];

  let baselineActiveCompanies: number;
  let baselineSuspendedCompanies: number;
  let baselineUsers: number;

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
            in: [
              SUPER_ADMIN_EMAIL,
              COMPANY_ADMIN_EMAIL,
              ACTIVE_ADMIN_1_EMAIL,
              ACTIVE_ADMIN_2_EMAIL,
              SUSPENDED_ADMIN_EMAIL,
            ],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            SUPER_ADMIN_EMAIL,
            COMPANY_ADMIN_EMAIL,
            ACTIVE_ADMIN_1_EMAIL,
            ACTIVE_ADMIN_2_EMAIL,
            SUSPENDED_ADMIN_EMAIL,
          ],
        },
      },
    });
    await prisma.tenant.deleteMany({ where: { name: { in: TENANT_NAMES } } });

    // Baseline captured before any of this suite's fixtures exist, so the
    // assertions below only depend on what THIS suite added.
    const [baselineTenantCounts, baselineUserCount] = await Promise.all([
      prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
    ]);
    baselineActiveCompanies =
      baselineTenantCounts.find((g) => g.status === 'ACTIVE')?._count._all ?? 0;
    baselineSuspendedCompanies =
      baselineTenantCounts.find((g) => g.status === 'SUSPENDED')?._count._all ??
      0;
    baselineUsers = baselineUserCount;

    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    // tenantId: null — a SUPER_ADMIN belongs to no tenant (D-008).
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

    const [activeTenant1, activeTenant2, suspendedTenant] = await Promise.all([
      prisma.tenant.create({
        data: { name: TENANT_NAMES[0], status: 'ACTIVE' },
      }),
      prisma.tenant.create({
        data: { name: TENANT_NAMES[1], status: 'ACTIVE' },
      }),
      prisma.tenant.create({
        data: { name: TENANT_NAMES[2], status: 'SUSPENDED' },
      }),
    ]);
    fixtureTenantIds = [activeTenant1.id, activeTenant2.id, suspendedTenant.id];

    // A non-SUPER_ADMIN user in one of the fixture tenants, for the 403 test.
    const companyAdmin = await prisma.user.create({
      data: {
        tenantId: activeTenant1.id,
        email: COMPANY_ADMIN_EMAIL,
        passwordHash,
        role: 'COMPANY_ADMIN',
        status: 'ACTIVE',
      },
    });
    // One additional staff user per fixture tenant so totalUsers has a
    // known, non-trivial delta (4: companyAdmin + these 3) to assert
    // against — not just "however many tenants" happens to equal
    // "however many users."
    const [activeAdmin1, activeAdmin2, suspendedAdmin] = await Promise.all([
      prisma.user.create({
        data: {
          tenantId: activeTenant1.id,
          email: ACTIVE_ADMIN_1_EMAIL,
          passwordHash,
          role: 'SUPPORT_USER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          tenantId: activeTenant2.id,
          email: ACTIVE_ADMIN_2_EMAIL,
          passwordHash,
          role: 'COMPANY_ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          tenantId: suspendedTenant.id,
          email: SUSPENDED_ADMIN_EMAIL,
          passwordHash,
          role: 'COMPANY_ADMIN',
          status: 'ACTIVE',
        },
      }),
    ]);
    fixtureUserIds = [
      companyAdmin.id,
      activeAdmin1.id,
      activeAdmin2.id,
      suspendedAdmin.id,
    ];

    const superAdminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SUPER_ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    superAdminCookies = extractCookies(superAdminLogin).join('; ');

    const companyAdminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: COMPANY_ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    companyAdminCookies = extractCookies(companyAdminLogin).join('; ');
  });

  afterAll(async () => {
    await prisma.userSession.deleteMany({
      where: { userId: { in: [superAdminId, ...fixtureUserIds] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminId, ...fixtureUserIds] } },
    });
    await prisma.tenant.deleteMany({ where: { id: { in: fixtureTenantIds } } });
    await app.close();
  });

  function extractCookies(response: request.Response): string[] {
    const cookies = response.headers['set-cookie'];
    if (!cookies) return [];
    return Array.isArray(cookies) ? cookies : [cookies];
  }

  it('returns aggregate counts reflecting the seeded 2 active + 1 suspended tenants', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/dashboard')
      .set('Cookie', superAdminCookies)
      .expect(200);

    expect(response.body.activeCompanies).toBe(baselineActiveCompanies + 2);
    expect(response.body.suspendedCompanies).toBe(
      baselineSuspendedCompanies + 1,
    );
    expect(response.body.totalCompanies).toBe(
      response.body.activeCompanies + response.body.suspendedCompanies,
    );

    // 4 non-SUPER_ADMIN users created above; the SUPER_ADMIN fixture itself
    // must NOT be counted (see the exclusion comment on DashboardService).
    expect(response.body.totalUsers).toBe(baselineUsers + 4);
  });

  // Ticket doesn't exist until Day 18 and AiRun until Day 29+ — this proves
  // the queries run correctly against genuinely empty tables (0, not an
  // error), not that they're stubbed.
  it('totalTickets and totalAiRequests are 0 against empty tables, no error', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/dashboard')
      .set('Cookie', superAdminCookies)
      .expect(200);

    expect(response.body.totalTickets).toBe(0);
    expect(response.body.totalAiRequests).toBe(0);
  });

  it('COMPANY_ADMIN -> 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/dashboard')
      .set('Cookie', companyAdminCookies)
      .expect(403);
  });

  it('no token -> 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/dashboard')
      .expect(401);
  });
});
