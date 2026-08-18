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
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    return toSafeUser(user);
  }
}
