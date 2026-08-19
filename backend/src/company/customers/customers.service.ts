import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type {
  CustomerResponseDto,
  PaginatedCustomersDto,
} from './dto/customer-response.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

// Prisma's unique index is (tenantId, email) — see D-013 / schema.prisma
// comment on Customer. A violation surfaces as P2002 with target
// ["tenant_id", "email"]; every write path below maps that specific
// violation to a 409 rather than letting it fall through as an unhandled
// 500, unlike CreateCompanyDto/CreateUserDto's known gap (that's a bigger,
// separate cleanup — this module isn't silently inheriting it).
function isDuplicateEmail(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(
    tenantId: string,
    dto: CreateCustomerDto,
    actorId: string,
  ): Promise<CustomerResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: {
            tenantId,
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            actorId,
            action: 'customer.created',
            targetType: 'customer',
            targetId: customer.id,
            metadata: { email: dto.email },
          },
        });

        return toCustomerResponse(customer);
      });
    } catch (error) {
      if (isDuplicateEmail(error)) {
        throw new ConflictException(
          'A customer with this email already exists.',
        );
      }
      throw error;
    }
  }

  async listCustomers(
    tenantId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedCustomersDto> {
    const { page, pageSize } = query;

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where: { tenantId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where: { tenantId } }),
    ]);

    return {
      data: customers.map(toCustomerResponse),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async updateCustomer(
    tenantId: string,
    id: string,
    dto: UpdateCustomerDto,
    actorId: string,
  ): Promise<CustomerResponseDto> {
    await this.findTenantCustomer(tenantId, id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.update({ where: { id }, data: dto });

        await tx.auditLog.create({
          data: {
            tenantId,
            actorId,
            action: 'customer.updated',
            targetType: 'customer',
            targetId: id,
            metadata: {},
          },
        });

        return toCustomerResponse(customer);
      });
    } catch (error) {
      if (isDuplicateEmail(error)) {
        throw new ConflictException(
          'A customer with this email already exists.',
        );
      }
      throw error;
    }
  }

  async deleteCustomer(
    tenantId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    await this.findTenantCustomer(tenantId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          action: 'customer.deleted',
          targetType: 'customer',
          targetId: id,
          metadata: {},
        },
      });
    });
  }

  // 404, not 403, for a wrong-tenant id — same "don't confirm existence of
  // something the caller has no business seeing" as UsersService.
  private async findTenantCustomer(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });

    if (!customer || customer.tenantId !== tenantId) {
      throw new NotFoundException();
    }

    return customer;
  }
}

function toCustomerResponse(customer: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerResponseDto {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}
