import { ApiProperty } from '@nestjs/swagger';

export class PlatformDashboardResponseDto {
  @ApiProperty() totalCompanies: number;
  @ApiProperty() activeCompanies: number;
  @ApiProperty() suspendedCompanies: number;
  @ApiProperty() totalUsers: number;
  @ApiProperty() totalTickets: number;
  @ApiProperty() totalAiRequests: number;
}
