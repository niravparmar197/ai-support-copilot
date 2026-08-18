import { ApiProperty } from '@nestjs/swagger';
import type { TenantStatus, UserStatus } from '@prisma/client';

export class CompanyAdminDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ nullable: true, type: String }) name: string | null;
  @ApiProperty() status: UserStatus;
  @ApiProperty() mustResetPassword: boolean;
  @ApiProperty() createdAt: Date;
}

export class CompanyDetailDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() status: TenantStatus;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: CompanyAdminDto, nullable: true })
  admin: CompanyAdminDto | null;
}

export class CompanyListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() status: TenantStatus;
  @ApiProperty({ nullable: true, type: String }) adminEmail: string | null;
  @ApiProperty() userCount: number;
  @ApiProperty() createdAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedCompaniesDto {
  @ApiProperty({ type: [CompanyListItemDto] }) data: CompanyListItemDto[];
  @ApiProperty({ type: PaginationMetaDto }) pagination: PaginationMetaDto;
}
