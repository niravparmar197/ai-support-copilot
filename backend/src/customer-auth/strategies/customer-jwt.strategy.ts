import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { CUSTOMER_ACCESS_TOKEN_COOKIE } from '../../auth/auth.constants';
import type { CustomerAccessTokenPayload } from '../types/customer-access-token-payload.type';
import { toSafeCustomer } from '../utils/to-safe-customer.util';

// Mirrors JwtStrategy — see that file for the cookie-extraction and
// fetch-fresh-every-request reasoning, both identical here. Registered
// under the 'customer-jwt' Passport strategy name (see
// CustomerJwtAuthGuard) so it never gets picked up by a plain
// AuthGuard('jwt') route.
function extractFromCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[CUSTOMER_ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  'customer-jwt',
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: extractFromCookie,
      secretOrKey: configService.getOrThrow<string>(
        'JWT_CUSTOMER_ACCESS_SECRET',
      ),
      ignoreExpiration: false,
    });
  }

  async validate(payload: CustomerAccessTokenPayload) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!customer) {
      throw new UnauthorizedException();
    }

    // Live check, same reasoning as JwtStrategy's tenant-suspended check —
    // closes the still-valid-access-token window, not just the next
    // refresh.
    if (customer.tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException();
    }

    return {
      ...toSafeCustomer(customer),
      sessionId: payload.sessionId,
    };
  }
}
