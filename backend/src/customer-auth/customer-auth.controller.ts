import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CUSTOMER_REFRESH_TOKEN_COOKIE } from '../auth/auth.constants';
import { requestMeta } from '../auth/utils/request-meta.util';
import { CustomerAuthService } from './customer-auth.service';
import { CurrentCustomer } from './decorators/current-customer.decorator';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';
import type { AuthenticatedCustomer } from './types/authenticated-customer.type';
import { toSafeCustomer } from './utils/to-safe-customer.util';

function readRefreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string | undefined> | undefined)?.[
    CUSTOMER_REFRESH_TOKEN_COOKIE
  ];
}

// Mirrors AuthController's login/refresh/logout/me shape — no
// sessions list/revoke, no impersonation (not asked for; see D-029).
@ApiTags('auth/customer')
@Controller('auth/customer')
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Log in as a customer' })
  @ApiResponse({
    status: 200,
    description: 'Logged in; sets the customer access and refresh cookies.',
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  async login(
    @Body() dto: CustomerLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const customer = await this.customerAuthService.validateCustomer(
      dto.email,
      dto.password,
    );
    await this.customerAuthService.login(customer, res, requestMeta(req));
    return toSafeCustomer(customer);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate the customer refresh token' })
  @ApiResponse({ status: 200, description: 'Rotated; sets new cookies.' })
  @ApiResponse({ status: 401, description: 'Missing, invalid, or expired token.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readRefreshCookie(req);

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    await this.customerAuthService.refresh(refreshToken, res, requestMeta(req));
    return { status: 'ok' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and revoke the current customer session' })
  @ApiResponse({ status: 200, description: 'Logged out; clears cookies.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.customerAuthService.logout(readRefreshCookie(req), res);
    return { status: 'ok' };
  }

  @Get('me')
  @UseGuards(CustomerJwtAuthGuard)
  @ApiOperation({ summary: 'Get the current authenticated customer' })
  @ApiResponse({ status: 200, description: 'The current customer.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  me(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return customer;
  }
}
