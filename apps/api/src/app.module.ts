import { Module } from '@nestjs/common';

import { ContentModule } from './content/content.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, ContentModule],
  controllers: [HealthController],
})
export class AppModule {}
