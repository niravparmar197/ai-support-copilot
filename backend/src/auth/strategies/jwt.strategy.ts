import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';
import type { AccessTokenPayload } from '../types/access-token-payload.type';
import { toSafeUser } from '../utils/to-safe-user.util';

// passport-jwt's default ExtractJwt.fromAuthHeaderAsBearerToken() reads an
// `Authorization: Bearer <token>` header. Our access token lives in an
// HttpOnly cookie specifically so client-side JS can never read it — that's
// what closes off XSS-based token theft. Since the frontend cannot read the
// cookie, it has no way to copy it into an Authorization header either, so
// the default extractor would never find anything to authenticate with. We
// read the cookie directly instead — this requires cookie-parser to have
// already run (it's registered globally in main.ts, before guards execute).
function extractFromCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: extractFromCookie,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // false (the default, stated explicitly) — passport-jwt/jsonwebtoken
      // check the token's `exp` claim and reject expired tokens before
      // validate() below ever runs.
      ignoreExpiration: false,
    });
  }

  async validate(payload: AccessTokenPayload) {
    // Fetched fresh rather than trusted from the payload, for two reasons:
    // (1) the payload only carries sub/tenantId/role (see Q3) — GET
    //     /auth/me needs the full current user, which isn't in the token;
    // (2) this doubles as a real-time ACTIVE-status check, bounded by the
    //     15-minute access token lifetime rather than a longer window.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    // Live check, not just "sessions were revoked when the tenant was
    // suspended" (CompaniesService.suspendCompany). An access token is a
    // self-contained JWT that stays cryptographically valid for its full
    // 15-minute lifetime regardless of what happens to the UserSession row
    // it was issued alongside — revoking that row only blocks the *next*
    // refresh, not the token currently in hand. This check is what
    // actually closes the "still-valid access token" window; session
    // revocation alone does not (see Q6 in the accompanying answer).
    if (user.tenant?.status === 'SUSPENDED') {
      throw new UnauthorizedException();
    }

    // Guarded on user.tenantId (not just payload.impersonatorId) so this
    // can never claim an impersonation for a tenant-less user — impersonation
    // targets are always a company's COMPANY_ADMIN (D-026), which always has
    // a tenant, but this stays correct instead of asserting it.
    const impersonatedBy =
      payload.impersonatorId && user.tenantId
        ? {
            userId: payload.impersonatorId,
            companyId: user.tenantId,
            companyName: user.tenant?.name ?? '',
          }
        : null;

    return {
      ...toSafeUser(user),
      sessionId: payload.sessionId,
      impersonatedBy,
    };
  }
}
