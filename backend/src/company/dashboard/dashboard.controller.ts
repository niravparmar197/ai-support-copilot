import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CompanyDashboardService } from './dashboard.service';
import { CompanyDashboardResponseDto } from './dto/dashboard-response.dto';

// user.tenantId! below: @Roles('COMPANY_ADMIN') guarantees a non-null
// tenantId (D-008), same reasoning as UsersController.
@ApiTags('company/dashboard')
@Controller('company/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMPANY_ADMIN')
export class CompanyDashboardController {
  constructor(private readonly dashboardService: CompanyDashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Tenant-scoped aggregate counts for the Company Admin dashboard',
  })
  @ApiResponse({ status: 200, type: CompanyDashboardResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Authenticated but not COMPANY_ADMIN.',
  })
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getDashboard(user.tenantId!);
  }
}
