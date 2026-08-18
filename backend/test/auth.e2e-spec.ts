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
    it('valid credentials -> 200, sets both auth cookies, creates a session row', async () => {
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

      const sessions = await prisma.userSession.findMany({
        where: { userId, revokedAt: null },
      });
      expect(sessions.length).toBeGreaterThanOrEqual(1);
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

// Separate top-level suite with its own app instance and its own tenant/
// users — same reasoning as the throttling suite below (fresh throttle
// counters), plus it needs multiple sessions/users in specific states that
// would be awkward to interleave with the main suite's shared test user.
//
// Test order matters here and is deliberate: later tests reuse tokens/
// cookies captured by earlier ones instead of logging in again, partly for
// realism (a stale refresh token has to come from a real prior login) and
// partly to stay well under the 5/min login-throttle budget within this
// one app instance.
describe('Session management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const EMAIL = 'session-mgmt-e2e@example.com';
  const OTHER_EMAIL = 'session-mgmt-e2e-other@example.com';
  const PASSWORD = 'correct-horse-battery-staple';
  let tenantId: string;
  let userId: string;
  let otherUserId: string;

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
      where: { email: { in: [EMAIL, OTHER_EMAIL] } },
    });
    await prisma.tenant.deleteMany({
      where: { name: 'Session Mgmt E2E Test Tenant' },
    });

    const tenant = await prisma.tenant.create({
      data: { name: 'Session Mgmt E2E Test Tenant', status: 'ACTIVE' },
    });
    tenantId = tenant.id;

    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    const user = await prisma.user.create({
      data: {
        tenantId,
        email: EMAIL,
        passwordHash,
        role: 'SUPPORT_USER',
        status: 'ACTIVE',
      },
    });
    userId = user.id;

    const otherUser = await prisma.user.create({
      data: {
        tenantId,
        email: OTHER_EMAIL,
        passwordHash,
        role: 'SUPPORT_USER',
        status: 'ACTIVE',
      },
    });
    otherUserId = otherUser.id;
  });

  afterAll(async () => {
    await prisma.userSession.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userId, otherUserId] } },
    });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  function extractCookies(response: request.Response): string[] {
    const cookies = response.headers['set-cookie'];
    if (!cookies) return [];
    return Array.isArray(cookies) ? cookies : [cookies];
  }

  function login() {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
  }

  // Captured across tests, in execution order — see the note above.
  let firstLoginCookies: string;
  let secondLoginCookies: string;

  it('refresh rotates: old session revoked, new one active', async () => {
    const loginResponse = await login();
    firstLoginCookies = extractCookies(loginResponse).join('; ');

    const activeBefore = await prisma.userSession.findMany({
      where: { userId, revokedAt: null },
    });
    expect(activeBefore).toHaveLength(1);
    const originalSessionId = activeBefore[0].id;

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstLoginCookies)
      .expect(200);

    const originalSession = await prisma.userSession.findUniqueOrThrow({
      where: { id: originalSessionId },
    });
    expect(originalSession.revokedAt).not.toBeNull();

    const activeAfter = await prisma.userSession.findMany({
      where: { userId, revokedAt: null },
    });
    expect(activeAfter).toHaveLength(1);
    expect(activeAfter[0].id).not.toBe(originalSessionId);
  });

  it('reusing an already-rotated refresh token revokes all sessions and returns 401', async () => {
    // firstLoginCookies now holds a *rotated* (revoked) refresh token, from
    // the previous test — replaying it is exactly the reuse scenario.
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstLoginCookies)
      .expect(401);

    expect(response.status).toBe(401);

    const activeSessions = await prisma.userSession.findMany({
      where: { userId, revokedAt: null },
    });
    // Including the session created by the legitimate rotation in the
    // previous test — reuse detection revokes *everything*, not just the
    // token that was replayed.
    expect(activeSessions).toHaveLength(0);
  });

  it('logout revokes only the current session', async () => {
    const deviceOneLogin = await login();
    const deviceOneCookies = extractCookies(deviceOneLogin).join('; ');

    const deviceTwoLogin = await login();
    secondLoginCookies = extractCookies(deviceTwoLogin).join('; ');

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', deviceOneCookies)
      .expect(200);

    const activeSessions = await prisma.userSession.findMany({
      where: { userId, revokedAt: null },
    });
    // Device two's session (secondLoginCookies) must survive device one's
    // logout — logout must not be revoking every session for the user.
    expect(activeSessions).toHaveLength(1);
  });

  it("DELETE /sessions/:id rejects revoking another user's session", async () => {
    // No need to log the other user in — a session row is all this needs,
    // and creating it directly avoids spending another login attempt.
    const otherUserSession = await prisma.userSession.create({
      data: {
        userId: otherUserId,
        refreshTokenHash: 'irrelevant-not-used-by-this-test',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    // secondLoginCookies (device two, still active from the previous test)
    // authenticates as `userId`, attempting to delete a session that
    // belongs to `otherUserId`.
    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${otherUserSession.id}`)
      .set('Cookie', secondLoginCookies)
      .expect(404);

    const stillActive = await prisma.userSession.findUniqueOrThrow({
      where: { id: otherUserSession.id },
    });
    expect(stillActive.revokedAt).toBeNull();
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
