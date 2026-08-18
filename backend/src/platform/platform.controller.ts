import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  // Proves the JwtAuthGuard -> RolesGuard chain works before any real
  // platform endpoints exist (Day 6+). Nothing else should be built on
  // this beyond that — replace, don't extend, when real endpoints land.
  @Get('ping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Guard-chain smoke test for platform routes' })
  @ApiResponse({ status: 200, description: 'ok' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Authenticated but not SUPER_ADMIN.' })
  ping() {
    return { ok: true };
  }
}
