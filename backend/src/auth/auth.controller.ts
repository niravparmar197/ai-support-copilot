import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { SessionResponseDto } from './dto/session-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/authenticated-user.type';
import { requestMeta } from './utils/request-meta.util';
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
    await this.authService.login(user, res, requestMeta(req));
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

    await this.authService.refresh(refreshToken, res, requestMeta(req));
    return { status: 'ok' };
  }

  // Public, not guarded: an already-expired access token shouldn't block
  // logout — the underlying revocation is driven entirely by the refresh
  // token cookie, not by anything JwtAuthGuard/@CurrentUser would provide.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and revoke the current session' })
  @ApiResponse({ status: 200, description: 'Logged out; clears cookies.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
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

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List the current user's active sessions" })
  @ApiResponse({ status: 200, type: [SessionResponseDto] })
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke one session' })
  @ApiResponse({ status: 200, description: 'Revoked.' })
  @ApiResponse({
    status: 404,
    description:
      "Session doesn't exist or doesn't belong to the current user (same response either way).",
  })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.authService.revokeSession(user.id, id);
    return { status: 'ok' };
  }

  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke every session except the current one' })
  @ApiResponse({ status: 200, description: 'Revoked; returns the count.' })
  revokeAllOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.revokeAllOtherSessions(user.id, user.sessionId);
  }

  // Deliberately JwtAuthGuard only, no @Roles — the caller is whoever is
  // *currently* impersonated (a COMPANY_ADMIN, never SUPER_ADMIN), so a
  // SUPER_ADMIN-only guard here would lock out the one identity that ever
  // needs to call this. AuthService.stopImpersonation() itself rejects the
  // call (400) if the caller's token has no impersonatorId claim to unwind.
  @Post('stop-impersonation')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'End the current impersonation session and restore the original SUPER_ADMIN session',
  })
  @ApiResponse({
    status: 200,
    description:
      'Restored; sets new auth cookies. Returns the id of the company that was being impersonated.',
  })
  @ApiResponse({ status: 400, description: 'Not currently impersonating.' })
  stopImpersonation(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.stopImpersonation(user, res, requestMeta(req));
  }
}
