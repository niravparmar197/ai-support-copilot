import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

// user.tenantId! below: @Roles('COMPANY_ADMIN') guarantees a non-null
// tenantId (D-008 — only SUPER_ADMIN ever has a null one), so every
// handler here always has a real tenant to scope against.
@ApiTags('company/users')
@Controller('company/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMPANY_ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a Support User in the caller’s company' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({
    status: 403,
    description: 'Authenticated but not COMPANY_ADMIN.',
  })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.createUser(user.tenantId!, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's company Support Users (paginated)" })
  @ApiResponse({ status: 200, type: PaginatedUsersDto })
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.listUsers(user.tenantId!, query);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a Support User and revoke their sessions (idempotent)',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No Support User with that id in the caller’s company.',
  })
  deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.deactivateUser(user.tenantId!, id, user.id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a Support User (idempotent)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No Support User with that id in the caller’s company.',
  })
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.activateUser(user.tenantId!, id, user.id);
  }
}
