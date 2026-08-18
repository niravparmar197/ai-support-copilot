import { ApiProperty } from '@nestjs/swagger';
import type { UserStatus } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ nullable: true, type: String }) name: string | null;
  @ApiProperty() status: UserStatus;
  @ApiProperty() mustResetPassword: boolean;
  @ApiProperty() createdAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserResponseDto] }) data: UserResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) pagination: PaginationMetaDto;
}
