import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  static [Symbol.hasInstance](instance: unknown) {
    return (
      typeof instance === 'object' &&
      instance !== null &&
      instance.constructor.name === PrismaService.name &&
      '$connect' in instance &&
      '$disconnect' in instance
    );
  }

  constructor() {
    super();
    Object.setPrototypeOf(this, PrismaService.prototype);
  }

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
