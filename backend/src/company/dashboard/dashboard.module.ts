import { Module } from '@nestjs/common';
import { CompanyDashboardController } from './dashboard.controller';
import { CompanyDashboardService } from './dashboard.service';

@Module({
  controllers: [CompanyDashboardController],
  providers: [CompanyDashboardService],
})
export class CompanyDashboardModule {}
