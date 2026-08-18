import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  BCRYPT_SALT_ROUNDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants';
import type { AccessTokenPayload } from './types/access-token-payload.type';
import type { RefreshTokenPayload } from './types/refresh-token-payload.type';

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  // No `domain` option — the __Host- prefix (see Q1) requires the Domain
  // attribute to be absent entirely. Setting it, even to the exact
  // hostname, makes the browser silently refuse to store the cookie.
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Never reveals *why* a login failed. "No user with that email",
   * "password didn't match", and "email matched more than one tenant"
   * (see the known-gap note below) all produce the exact same message, so
   * this endpoint can't be used to enumerate registered emails.
   */
  async validateUser(email: string, password: string): Promise<User> {
    // KNOWN GAP: User.email is unique per-tenant, not globally
    // (@@unique([tenantId, email]) — D-009), specifically so the same
    // email can belong to different accounts in different tenants. This
    // endpoint has no tenant context to disambiguate with — LoginDto is
    // email/password only, per the task spec. `take: 2` below is enough to
    // detect "more than one match" without a separate count query; if that
    // happens, we refuse to guess which account to log into and fail the
    // same generic way as a wrong password. Real fix is tenant resolution
    // before login (subdomain, workspace picker) — not built here.
    const matches = await this.prisma.user.findMany({
      where: { email },
      take: 2,
    });

    if (matches.length !== 1) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const [user] = matches;
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    return user;
  }

  /**
   * Signs a fresh access+refresh pair, stores the refresh token's hash in a
   * new UserSession row, and sets both cookies on the response. Also the
   * rotation target for refresh() — a refresh mints a new pair the same
   * way a login does.
   */
  async login(
    user: User,
    res: Response,
    meta: { userAgent?: string; ip?: string },
  ): Promise<void> {
    const accessTokenPayload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    // Generated up front (not left to Prisma's @default(cuid())) because
    // the refresh JWT below needs to carry this id before the UserSession
    // row exists — the token has to say which row to check against, since
    // bcrypt hashes can't be queried by value (see refresh-token-payload
    // type). Not a cuid, just a unique string; the id column has no format
    // constraint at the DB level.
    const sessionId = randomUUID();

    const refreshTokenPayload: RefreshTokenPayload = {
      sub: user.id,
      sessionId,
    };

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });

    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });

    this.setAuthCookies(res, accessToken, refreshToken);
  }

  /**
   * Rotation, not renewal: every successful refresh revokes the session the
   * presented token belonged to and creates a brand new one via login().
   * MUST rotate on every use — access token: 15 min, refresh token: 7 days.
   * Reuse of an already-rotated refresh token is treated as a suspected
   * theft signal: logged today, full cross-session revocation cascade is
   * Day 4 (not implemented here).
   */
  async refresh(refreshToken: string, res: Response): Promise<void> {
    let payload: RefreshTokenPayload;

    try {
      // jsonwebtoken's verify() (which JwtService.verifyAsync wraps) checks
      // BOTH the signature AND the `exp` claim by default — it throws
      // TokenExpiredError for an expired token and JsonWebTokenError for a
      // bad/tampered signature. Confirmed, not assumed: nothing further
      // needs to be checked manually beyond letting this call throw.
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException();
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException();
    }

    if (session.revokedAt) {
      // The session tied to this token was already rotated (or explicitly
      // revoked) once — presenting it again means either a client retried
      // a stale token, or it was stolen and is being replayed. For today
      // this is only logged; it doesn't yet trigger revoking the user's
      // other sessions (Day 4).
      this.logger.warn(
        `Refresh token reuse detected for user ${session.userId} (session ${session.id}) — treating as suspected theft, not acting on it yet (Day 4).`,
      );
      throw new UnauthorizedException();
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }

    const hashMatches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!hashMatches) {
      throw new UnauthorizedException();
    }

    // Re-fetched fresh rather than trusting the refresh token's own claims
    // (it only carries sub/sessionId) or the days-old session row, so the
    // new access token reflects the user's *current* role/tenant — a role
    // change shouldn't persist for the full 7-day refresh-token lifetime.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    // Rotate: revoke the old session, then issue a new pair via login()
    // (which creates a brand new UserSession row, not an in-place hash
    // update). A new row per rotation is what makes "reuse of an
    // already-rotated token" the cheap, direct check above
    // (revokedAt IS NOT NULL) rather than something reconstructed after
    // the fact.
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await this.login(user, res, {
      userAgent: session.userAgent ?? undefined,
      ip: session.ip ?? undefined,
    });
  }

  /**
   * Takes the refresh token (not just the user id) because knowing *who*
   * is logging out doesn't say *which* session/device to revoke — a user
   * can have several active UserSession rows (one per device, plus one per
   * past rotation). Tolerant of a missing/invalid token: logout should
   * always succeed from the client's perspective, since the cookies get
   * cleared either way.
   */
  async logout(
    refreshToken: string | undefined,
    res: Response,
  ): Promise<void> {
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
          refreshToken,
          {
            secret: this.configService.getOrThrow<string>(
              'JWT_REFRESH_SECRET',
            ),
          },
        );

        await this.prisma.userSession.updateMany({
          where: { id: payload.sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } catch {
        // Already invalid/expired — nothing to revoke.
      }
    }

    this.clearAuthCookies(res);
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }
}
