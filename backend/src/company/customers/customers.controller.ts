import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import {
  CustomerResponseDto,
  PaginatedCustomersDto,
} from './dto/customer-response.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

// user.tenantId! below: @Roles() (class- or method-level, both only ever
// list COMPANY_ADMIN/SUPPORT_USER) guarantees a non-null tenantId (D-008),
// same reasoning as UsersController/CompanyDashboardController.
@ApiTags('company/customers')
@Controller('company/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMPANY_ADMIN', 'SUPPORT_USER')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles('COMPANY_ADMIN')
  @ApiOperation({ summary: 'Create a customer in the caller’s company' })
  @ApiResponse({ status: 201, type: CustomerResponseDto })
  @ApiResponse({
    status: 409,
    description: 'A customer with this email already exists.',
  })
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.createCustomer(user.tenantId!, dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: "List the caller's company customers (paginated)",
  })
  @ApiResponse({ status: 200, type: PaginatedCustomersDto })
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.listCustomers(user.tenantId!, query);
  }

  @Patch(':id')
  @Roles('COMPANY_ADMIN')
  @ApiOperation({ summary: 'Update a customer' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No customer with that id in the caller’s company.',
  })
  @ApiResponse({
    status: 409,
    description: 'A customer with this email already exists.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.updateCustomer(
      user.tenantId!,
      id,
      dto,
      user.id,
    );
  }

  @Delete(':id')
  @Roles('COMPANY_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a customer' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({
    status: 404,
    description: 'No customer with that id in the caller’s company.',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.deleteCustomer(user.tenantId!, id, user.id);
  }
}
