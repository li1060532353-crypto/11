import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ContentController } from './content.controller';
import { ContentRepository } from './content.repository';
import { ContentService } from './content.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContentController],
  providers: [ContentRepository, ContentService],
})
export class ContentModule {}
