import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Platform guard chain (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const PASSWORD = 'correct-horse-battery-staple';
  const SUPER_ADMIN_EMAIL = 'platform-e2e-super-admin@example.com';
  const COMPANY_ADMIN_EMAIL = 'platform-e2e-company-admin@example.com';

  let tenantId: string;
  let superAdminId: string;
  let companyAdminId: string;

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

    await prisma.user.deleteMany({
      where: { email: { in: [SUPER_ADMIN_EMAIL, COMPANY_ADMIN_EMAIL] } },
    });
    await prisma.tenant.deleteMany({
      where: { name: 'Platform Guard E2E Test Tenant' },
    });

    const tenant = await prisma.tenant.create({
      data: { name: 'Platform Guard E2E Test Tenant', status: 'ACTIVE' },
    });
    tenantId = tenant.id;

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
  });

  afterAll(async () => {
    await prisma.userSession.deleteMany({
      where: { userId: { in: [superAdminId, companyAdminId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [superAdminId, companyAdminId] } },
    });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  function loginAs(email: string) {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
  }

  function cookieHeaderFrom(response: request.Response): string {
    const cookies = response.headers['set-cookie'];
    const list = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
    return list.join('; ');
  }

  it('SUPER_ADMIN -> 200', async () => {
    const loginResponse = await loginAs(SUPER_ADMIN_EMAIL);
    const cookies = cookieHeaderFrom(loginResponse);

    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/ping')
      .set('Cookie', cookies)
      .expect(200);

    expect(response.body).toEqual({ ok: true });
  });

  it('COMPANY_ADMIN -> 403', async () => {
    const loginResponse = await loginAs(COMPANY_ADMIN_EMAIL);
    const cookies = cookieHeaderFrom(loginResponse);

    await request(app.getHttpServer())
      .get('/api/v1/platform/ping')
      .set('Cookie', cookies)
      .expect(403);
  });

  it('no token -> 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/platform/ping').expect(401);
  });

  it('401 and 403 are distinguished, not collapsed to one status', async () => {
    const unauthenticated = await request(app.getHttpServer()).get(
      '/api/v1/platform/ping',
    );

    const loginResponse = await loginAs(COMPANY_ADMIN_EMAIL);
    const wrongRole = await request(app.getHttpServer())
      .get('/api/v1/platform/ping')
      .set('Cookie', cookieHeaderFrom(loginResponse));

    expect(unauthenticated.status).toBe(401);
    expect(wrongRole.status).toBe(403);
    expect(unauthenticated.status).not.toBe(wrongRole.status);
  });
});
