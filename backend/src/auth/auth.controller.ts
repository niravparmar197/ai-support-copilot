import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_COOKIE } from './auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/authenticated-user.type';
import { toSafeUser } from './utils/to-safe-user.util';

function readRefreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string | undefined> | undefined)?.[
    REFRESH_TOKEN_COOKIE
  ];
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Tighter than the global default (100/min, app.module.ts) — login is a
  // credential-guessing target, so it gets its own limit rather than
  // inheriting the general-purpose one.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Logged in; sets the access and refresh cookies.',
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    await this.authService.login(user, res, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    return toSafeUser(user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Rotate the refresh token and mint a new access token',
  })
  @ApiResponse({ status: 200, description: 'Rotated; sets new cookies.' })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, expired, or already-rotated token.',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readRefreshCookie(req);

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    await this.authService.refresh(refreshToken, res);
    return { status: 'ok' };
  }

  // Public, not guarded: an already-expired access token shouldn't block
  // logout — the underlying revocation is driven entirely by the refresh
  // token cookie, not by anything JwtAuthGuard/@CurrentUser would provide.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and revoke the current session' })
  @ApiResponse({ status: 200, description: 'Logged out; clears cookies.' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(readRefreshCookie(req), res);
    return { status: 'ok' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'The current user (never includes passwordHash).',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
