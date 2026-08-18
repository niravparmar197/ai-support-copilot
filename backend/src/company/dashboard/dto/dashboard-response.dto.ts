import { ApiProperty } from '@nestjs/swagger';

export class CompanyDashboardResponseDto {
  @ApiProperty() totalUsers: number;
  @ApiProperty() totalCustomers: number;
  @ApiProperty() totalTickets: number;
  @ApiProperty() totalDocuments: number;
  @ApiProperty() totalAiRequests: number;
}
