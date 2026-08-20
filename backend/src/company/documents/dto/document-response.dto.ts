import { ApiProperty } from '@nestjs/swagger';
import type { DocumentStatus } from '@prisma/client';

export class DocumentUploaderSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true, type: String }) name: string | null;
  @ApiProperty() email: string;
}

export class DocumentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() filename: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty({ enum: ['UPLOADED', 'PROCESSING', 'INDEXED', 'FAILED'] })
  status: DocumentStatus;
  @ApiProperty({ type: DocumentUploaderSummaryDto }) uploadedBy: DocumentUploaderSummaryDto;
  @ApiProperty() createdAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedDocumentsDto {
  @ApiProperty({ type: [DocumentResponseDto] }) data: DocumentResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) pagination: PaginationMetaDto;
}
