import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersService } from './orders.service';

// Read-only for both roles — unlike CustomersController, there's no write
// path here at all today (no order-taking workflow, see the plan note),
// so there's nothing for a COMPANY_ADMIN-only override to restrict.
@ApiTags('company/orders')
@Controller('company/customers/:customerId/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMPANY_ADMIN', 'SUPPORT_USER')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List a customer’s orders, with their payments' })
  @ApiResponse({ status: 200, type: [OrderResponseDto] })
  @ApiResponse({
    status: 404,
    description: 'No customer with that id in the caller’s company.',
  })
  list(
    @Param('customerId') customerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.listForCustomer(user.tenantId!, customerId);
  }
}
