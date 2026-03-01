import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { UseCaseResponse } from '../common/responses/use-case-response.interface';

interface HealthData {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptime: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check service health and database connectivity' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is degraded' })
  async check(): Promise<UseCaseResponse<HealthData>> {
    let dbStatus: 'up' | 'down' = 'down';

    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    const isHealthy = dbStatus === 'up';

    return {
      data: {
        status: isHealthy ? 'ok' : 'degraded',
        database: dbStatus,
        uptime: process.uptime(),
      },
      statusCode: isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
      message: isHealthy ? 'Service is healthy' : 'Service is degraded',
    };
  }
}
