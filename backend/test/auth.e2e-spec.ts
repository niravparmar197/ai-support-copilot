import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

// Note on cookies here: Supertest talks directly to the Nest/Express app,
// not through a real browser — it does not enforce Secure-requires-HTTPS
// or SameSite cross-site rules. It just reports whatever Set-Cookie headers
// the server actually sent, and will forward any Cookie header it's given
// on the next request regardless of those flags. So these tests verify the
// server-side cookie logic correctly, but passing here is not proof the
// real browser flow works — that also needs the mkcert HTTPS setup
// described in main.ts (see Q1 in the design discussion).
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const TEST_EMAIL = 'auth-e2e-test@example.com';
  const TEST_PASSWORD = 'correct-horse-battery-staple';
  let tenantId: string;
  let userId: string;

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

    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.tenant.deleteMany({ where: { name: 'Auth E2E Test Tenant' } });

    const tenant = await prisma.tenant.create({
      data: { name: 'Auth E2E Test Tenant', status: 'ACTIVE' },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: TEST_EMAIL,
        passwordHash,
        role: 'SUPPORT_USER',
        status: 'ACTIVE',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.userSession.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  function extractCookies(response: request.Response): string[] {
    const cookies = response.headers['set-cookie'];
    if (!cookies) return [];
    return Array.isArray(cookies) ? cookies : [cookies];
  }

  describe('POST /auth/login', () => {
    it('valid credentials -> 200 and sets both auth cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
        .expect(200);

      const cookies = extractCookies(response);
      expect(
        cookies.some((c) => c.startsWith('__Host-access_token=')),
      ).toBe(true);
      expect(
        cookies.some((c) => c.startsWith('__Host-refresh_token=')),
      ).toBe(true);
    });

    it('wrong password -> 401 with a generic message', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: TEST_EMAIL, password: 'not-the-right-password' })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password.');
    });

    it('missing email -> 400 validation error', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ password: TEST_PASSWORD })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('without a cookie -> 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('with a valid cookie -> 200 with the user payload, no passwordHash', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
        .expect(200);

      const cookieHeader = extractCookies(loginResponse).join('; ');

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', cookieHeader)
        .expect(200);

      expect(meResponse.body.email).toBe(TEST_EMAIL);
      expect(meResponse.body).not.toHaveProperty('passwordHash');
    });
  });
});

// Separate top-level suite with its own app instance, deliberately: the
// throttle guard's hit counter is shared across every request the app
// instance handles. Sharing the app above would make this test's outcome
// depend on exactly how many /auth/login calls the other tests happen to
// make first — fragile to reordering. A fresh app gets a fresh counter, so
// "the 6th attempt is throttled" is true regardless of what else runs.
describe('Auth throttling (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('6th login attempt within a minute -> 429', async () => {
    // Credentials don't need to be real: ThrottlerGuard runs before
    // validation/business logic, so every attempt counts against the
    // limit regardless of whether it would otherwise succeed.
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'irrelevant' });

    for (let i = 0; i < 5; i++) {
      const response = await attempt();
      expect(response.status).not.toBe(429);
    }

    const sixth = await attempt();
    expect(sixth.status).toBe(429);
  });
});
