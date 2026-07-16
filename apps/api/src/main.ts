import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@namdw/shared';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const host = process.env.API_HOST ?? '127.0.0.1';
  const port = Number(process.env.API_PORT ?? 3000);

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  await app.listen(port, host);
}

void bootstrap();
