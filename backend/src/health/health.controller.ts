import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({
    status: 200,
    description: 'Service is up.',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-08-18T12:00:00.000Z',
        uptime: 12.34,
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
