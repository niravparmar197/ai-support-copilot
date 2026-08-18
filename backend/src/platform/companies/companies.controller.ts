import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from '../../auth/auth.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { requestMeta } from '../../auth/utils/request-meta.util';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CompaniesService } from './companies.service';
import {
  CompanyDetailDto,
  PaginatedCompaniesDto,
} from './dto/company-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('platform/companies')
@Controller('platform/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a company (Tenant + first COMPANY_ADMIN)' })
  @ApiResponse({ status: 201, description: 'Created.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Authenticated but not SUPER_ADMIN.',
  })
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.createCompany(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List companies (paginated)' })
  @ApiResponse({ status: 200, type: PaginatedCompaniesDto })
  list(@Query() query: PaginationQueryDto) {
    return this.companiesService.listCompanies(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single company, with its admin user' })
  @ApiResponse({ status: 200, type: CompanyDetailDto })
  @ApiResponse({ status: 404, description: 'No company with that id.' })
  get(@Param('id') id: string) {
    return this.companiesService.getCompany(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update company metadata (name) — never status, see suspend/activate',
  })
  @ApiResponse({ status: 200, type: CompanyDetailDto })
  @ApiResponse({ status: 404, description: 'No company with that id.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.updateCompany(id, dto, user.id);
  }

  @Patch(':id/suspend')
  @ApiOperation({
    summary:
      'Suspend a company and revoke all its users’ sessions (idempotent)',
  })
  @ApiResponse({ status: 200, type: CompanyDetailDto })
  @ApiResponse({ status: 404, description: 'No company with that id.' })
  suspend(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.suspendCompany(id, user.id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a company (idempotent)' })
  @ApiResponse({ status: 200, type: CompanyDetailDto })
  @ApiResponse({ status: 404, description: 'No company with that id.' })
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.activateCompany(id, user.id);
  }

  // Tenant-isolation boundary: this starts a session AS this company's
  // admin — everything the impersonated identity subsequently sees is
  // scoped to that one company, same as if its admin had logged in
  // themselves. It does not grant the SUPER_ADMIN any new cross-tenant
  // read/write beyond "act as this one user," and it never returns that
  // user's data in the response — only an ack; the frontend re-fetches
  // GET /auth/me (which now reports impersonatedBy, see JwtStrategy) to
  // pick up the new identity.
  @Post(':id/impersonate')
  @ApiOperation({
    summary: "Start impersonating a company's primary COMPANY_ADMIN",
  })
  @ApiResponse({
    status: 200,
    description: 'Impersonation session started; sets new auth cookies.',
  })
  @ApiResponse({
    status: 404,
    description: 'No company with that id, or it has no admin user.',
  })
  @ApiResponse({ status: 409, description: 'Company is suspended.' })
  async impersonate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const target = await this.companiesService.getImpersonationTarget(id);
    await this.authService.impersonate(target, user, res, requestMeta(req));
    return { status: 'ok' };
  }
}
