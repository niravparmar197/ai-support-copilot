import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Customer } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import {
  BCRYPT_SALT_ROUNDS,
  CUSTOMER_ACCESS_TOKEN_COOKIE,
  CUSTOMER_REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../auth/auth.constants';
import { PrismaService } from '../prisma/prisma.service';
import type { CustomerAccessTokenPayload } from './types/customer-access-token-payload.type';
import type { CustomerRefreshTokenPayload } from './types/customer-refresh-token-payload.type';

type RequestMeta = { userAgent?: string; ip?: string };

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

// Mirrors AuthService — see that file for the extensive reasoning behind
// each piece (timing-safe generic errors, rotation, reuse-detection). This
// is a deliberate parallel implementation, not a shared/generalized base
// — see D-029.
@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateCustomer(email: string, password: string): Promise<Customer> {
    // Same per-tenant-not-global email ambiguity as AuthService.validateUser
    // — Customer.email is unique on (tenantId, email), not globally (same
    // shape as User, D-009's known gap). Refuses to guess which tenant's
    // customer to log into if more than one email matches.
    const matches = await this.prisma.customer.findMany({
      where: { email },
      take: 2,
      include: { tenant: true },
    });

    if (matches.length !== 1) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const [customer] = matches;

    // bcrypt.compare runs unconditionally — same timing-side-channel
    // reasoning as AuthService.validateUser.
    const passwordMatches = await bcrypt.compare(
      password,
      customer.passwordHash,
    );

    if (!passwordMatches || customer.tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    return customer;
  }

  async login(
    customer: Customer,
    res: Response,
    meta: RequestMeta,
  ): Promise<void> {
    const sessionId = randomUUID();

    const accessTokenPayload: CustomerAccessTokenPayload = {
      sub: customer.id,
      tenantId: customer.tenantId,
      sessionId,
    };

    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: this.configService.getOrThrow<string>(
        'JWT_CUSTOMER_ACCESS_SECRET',
      ),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshTokenPayload: CustomerRefreshTokenPayload = {
      sub: customer.id,
      sessionId,
    };

    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: this.configService.getOrThrow<string>(
        'JWT_CUSTOMER_REFRESH_SECRET',
      ),
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });

    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.customerSession.create({
      data: {
        id: sessionId,
        customerId: customer.id,
        refreshTokenHash,
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });

    this.setAuthCookies(res, accessToken, refreshToken);
  }

  /** Rotation + reuse-detection, identical reasoning to AuthService.refresh. */
  async refresh(
    refreshToken: string,
    res: Response,
    meta: RequestMeta,
  ): Promise<void> {
    let payload: CustomerRefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<CustomerRefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>(
            'JWT_CUSTOMER_REFRESH_SECRET',
          ),
        },
      );
    } catch {
      throw new UnauthorizedException();
    }

    const session = await this.prisma.customerSession.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.customerId !== payload.sub) {
      throw new UnauthorizedException();
    }

    if (session.revokedAt) {
      this.logger.warn(
        `customer_refresh_token_reuse_detected customerId=${session.customerId} sessionId=${session.id}`,
      );

      await this.prisma.customerSession.updateMany({
        where: { customerId: session.customerId, revokedAt: null },
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

    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.sub },
    });

    if (!customer) {
      throw new UnauthorizedException();
    }

    await this.prisma.customerSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await this.login(customer, res, meta);
  }

  async logout(refreshToken: string | undefined, res: Response): Promise<void> {
    if (refreshToken) {
      try {
        const payload =
          await this.jwtService.verifyAsync<CustomerRefreshTokenPayload>(
            refreshToken,
            {
              secret: this.configService.getOrThrow<string>(
                'JWT_CUSTOMER_REFRESH_SECRET',
              ),
            },
          );

        await this.prisma.customerSession.updateMany({
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
    res.cookie(CUSTOMER_ACCESS_TOKEN_COOKIE, accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });

    res.cookie(CUSTOMER_REFRESH_TOKEN_COOKIE, refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(CUSTOMER_ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(CUSTOMER_REFRESH_TOKEN_COOKIE, { path: '/' });
  }
}
