import { Controller, Get } from '@nestjs/common';
import { apiSuccess, type ApiSuccess } from '@namdw/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): ApiSuccess<{ status: 'ok' }> {
    return apiSuccess({ status: 'ok' });
  }
}
