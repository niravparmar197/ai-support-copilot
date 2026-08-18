import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { PlatformDashboardResponseDto } from './dto/dashboard-response.dto';

@ApiTags('platform/dashboard')
@Controller('platform/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Platform-wide aggregate counts for the SUPER_ADMIN dashboard',
  })
  @ApiResponse({ status: 200, type: PlatformDashboardResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Authenticated but not SUPER_ADMIN.',
  })
  // Tenant-isolation boundary: this returns AGGREGATE counts only, never
  // per-tenant data. A SUPER_ADMIN sees "47 total tickets across the
  // platform," never the content — or even the per-company breakdown — of
  // any tenant's tickets, customers, or users. SUPER_ADMIN bypasses normal
  // tenant filtering elsewhere (e.g. platform/companies), but that bypass
  // does not extend to this endpoint returning tenant-scoped rows.
  //
  // Caching: this is aggregate data across potentially many rows and
  // doesn't need to be real-time to the second, so it's a reasonable
  // candidate for a short-TTL Redis cache once this gets real traffic.
  // Not implemented here — that's Day 57's territory.
  getDashboard(): Promise<PlatformDashboardResponseDto> {
    return this.dashboardService.getDashboard();
  }
}
