import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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
import type { SessionResponseDto } from './dto/session-response.dto';
import type { AccessTokenPayload } from './types/access-token-payload.type';
import type { AuthenticatedUser } from './types/authenticated-user.type';
import type { RefreshTokenPayload } from './types/refresh-token-payload.type';
import { parseUserAgentLabel } from './utils/parse-user-agent.util';

type RequestMeta = { userAgent?: string; ip?: string };

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
   * "password didn't match", "email matched more than one tenant" (see the
   * known-gap note below), and "the user's tenant is suspended" all
   * produce the exact same message and, just as importantly, take the same
   * amount of time — see the bcrypt note below for why that second part
   * matters.
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
      include: { tenant: true },
    });

    if (matches.length !== 1) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const [user] = matches;

    // bcrypt.compare runs unconditionally, even though a suspended tenant
    // already means this login will be rejected regardless of the
    // password. Skipping it for that case would make "suspended tenant"
    // rejections measurably faster than "wrong password" ones (bcrypt is
    // deliberately slow) — a timing side-channel that leaks the exact
    // "is this company suspended" signal the generic message is supposed
    // to hide. Same response, same latency, regardless of which check
    // actually fails.
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches || user.tenant?.status === 'SUSPENDED') {
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
    meta: RequestMeta,
    // Set only when this login is AuthService.impersonate() minting a
    // session for a company admin on a SUPER_ADMIN's behalf — carried onto
    // both token payloads (D-026). Absent (undefined) for every ordinary
    // login/refresh, including AuthService.stopImpersonation()'s login of
    // the original SUPER_ADMIN, which deliberately does not pass one.
    impersonatorId?: string,
  ): Promise<void> {
    // Generated up front (not left to Prisma's @default(cuid())) because
    // both token payloads below need to carry this id before the
    // UserSession row exists — the refresh token has to say which row to
    // check against (bcrypt hashes can't be queried by value), and the
    // access token carries it too so an authenticated request can identify
    // "which session is this one" for session management. Not a cuid, just
    // a unique string; the id column has no format constraint at the DB
    // level.
    const sessionId = randomUUID();

    const accessTokenPayload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      sessionId,
      ...(impersonatorId ? { impersonatorId } : {}),
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshTokenPayload: RefreshTokenPayload = {
      sub: user.id,
      sessionId,
      ...(impersonatorId ? { impersonatorId } : {}),
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
   * Reuse of an already-rotated refresh token is treated as confirmed
   * theft: every session for that user gets revoked (not just the reused
   * one), forcing a fresh login everywhere. Logged distinctly
   * (refresh_token_reuse_detected) so it's greppable/alertable on later.
   */
  async refresh(
    refreshToken: string,
    res: Response,
    meta: RequestMeta,
  ): Promise<void> {
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
      // a stale token, or (more concerning) it was stolen and is being
      // replayed by someone who captured it before the legitimate rotation.
      // Since we can't tell those apart, we treat it as theft: kill every
      // session this user has, not just this one, so a stolen token can't
      // keep working even if it targets a different session than the one
      // that tipped us off.
      this.logger.warn(
        `refresh_token_reuse_detected userId=${session.userId} sessionId=${session.id}`,
      );

      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

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

    // Uses the *current* request's userAgent/ip (passed in by the
    // controller), not the old session's — the new session row should
    // reflect the device actually making this refresh call, not whatever
    // was recorded when the session was first created, which could be
    // stale after several rotations. payload.impersonatorId is passed
    // through so an impersonation session survives rotation instead of
    // silently turning into an ordinary one the first time the 15-minute
    // access token expires (D-026).
    await this.login(user, res, meta, payload.impersonatorId);
  }

  /**
   * Takes the refresh token (not just the user id) because knowing *who*
   * is logging out doesn't say *which* session/device to revoke — a user
   * can have several active UserSession rows (one per device, plus one per
   * past rotation). Tolerant of a missing/invalid token: logout should
   * always succeed from the client's perspective, since the cookies get
   * cleared either way.
   */
  async logout(refreshToken: string | undefined, res: Response): Promise<void> {
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
          refreshToken,
          {
            secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
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

  /**
   * Starts a SUPER_ADMIN impersonating `target` (D-026). Revokes the
   * actor's own current session first — same rotate-on-use idiom as
   * refresh() — so it doesn't linger, valid but unused, once the browser's
   * cookies are overwritten with the target's tokens below. Callers are
   * responsible for authorization (only SUPER_ADMIN should reach this —
   * enforced by CompaniesController's @Roles guard, not re-checked here)
   * and for resolving *which* user `target` is
   * (CompaniesService.getImpersonationTarget()).
   */
  async impersonate(
    target: User,
    actor: AuthenticatedUser,
    res: Response,
    meta: RequestMeta,
  ): Promise<void> {
    await this.prisma.userSession.update({
      where: { id: actor.sessionId },
      data: { revokedAt: new Date() },
    });

    await this.login(target, res, meta, actor.id);

    await this.prisma.auditLog.create({
      data: {
        tenantId: target.tenantId,
        actorId: actor.id,
        action: 'company.impersonation.started',
        targetType: 'user',
        targetId: target.id,
        metadata: { companyId: target.tenantId },
      },
    });
  }

  /**
   * The inverse of impersonate(): revokes the impersonation session and
   * mints the original SUPER_ADMIN a brand new session — it does not
   * attempt to resurrect the one revoked when impersonation started (see
   * D-026's trade-off note). Returns the impersonated company's tenant id
   * so the caller (AuthController) can tell the frontend which company
   * page to land back on.
   */
  async stopImpersonation(
    actor: AuthenticatedUser,
    res: Response,
    meta: RequestMeta,
  ): Promise<{ companyId: string }> {
    if (!actor.impersonatedBy) {
      throw new BadRequestException('Not currently impersonating.');
    }

    // actor.tenantId is guaranteed non-null here: JwtStrategy only ever
    // sets impersonatedBy when the authenticated user has a tenantId (see
    // its guard comment) — checked again anyway rather than asserted, so a
    // future change to that invariant fails loudly here instead of
    // producing a silently wrong companyId.
    if (!actor.tenantId) {
      throw new UnauthorizedException();
    }

    await this.prisma.userSession.update({
      where: { id: actor.sessionId },
      data: { revokedAt: new Date() },
    });

    const originalUser = await this.prisma.user.findUnique({
      where: { id: actor.impersonatedBy.userId },
    });

    if (
      !originalUser ||
      originalUser.status !== 'ACTIVE' ||
      originalUser.role !== 'SUPER_ADMIN'
    ) {
      throw new UnauthorizedException();
    }

    await this.login(originalUser, res, meta);

    const companyId = actor.tenantId;

    await this.prisma.auditLog.create({
      data: {
        tenantId: companyId,
        actorId: originalUser.id,
        action: 'company.impersonation.stopped',
        targetType: 'user',
        targetId: actor.id,
        metadata: { companyId },
      },
    });

    return { companyId };
  }

  /**
   * Active sessions for a user — non-revoked, non-expired only. Marks
   * which one is `currentSessionId` (the session the request making this
   * call is itself authenticated with) so the UI can distinguish "this
   * device" from "other devices" without the client having to know its
   * own session id ahead of time.
   */
  async listSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      label: parseUserAgentLabel(session.userAgent),
      ip: session.ip,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === currentSessionId,
    }));
  }

  /**
   * Revokes exactly one session. Returns the same 404 whether the id
   * doesn't exist at all or exists but belongs to a different user —
   * distinguishing the two would let a caller probe session ids to find
   * out which ones are real.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException();
    }

    if (!session.revokedAt) {
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    }
  }

  /** Revokes every active session for a user except the current one. */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<{ revokedCount: number }> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { revokedCount: result.count };
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
