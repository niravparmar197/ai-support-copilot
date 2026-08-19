import { Injectable, NotFoundException } from '@nestjs/common';
import type { Order, Payment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { OrderResponseDto } from './dto/order-response.dto';

// Read-only, deliberately — this data exists mainly for later AI tools
// (get_order/get_payment). No pagination: Order's own schema.prisma
// comment notes it isn't meant to be a tenant-wide paginated list the way
// Ticket is, only ever viewed per-customer, and a single customer's order
// count is realistically small.
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<OrderResponseDto[]> {
    // 404, not 403, for a wrong-tenant customer id — same reasoning as
    // every other lookup in this app.
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer || customer.tenantId !== tenantId) {
      throw new NotFoundException();
    }

    const orders = await this.prisma.order.findMany({
      where: { tenantId, customerId },
      orderBy: { createdAt: 'desc' },
      include: { payments: { orderBy: { createdAt: 'asc' } } },
    });

    return orders.map(toOrderResponse);
  }
}

function toOrderResponse(order: Order & { payments: Payment[] }): OrderResponseDto {
  return {
    id: order.id,
    totalAmount: order.totalAmount.toString(),
    status: order.status,
    createdAt: order.createdAt,
    payments: order.payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toString(),
      status: payment.status,
      method: payment.method,
      createdAt: payment.createdAt,
    })),
  };
}
