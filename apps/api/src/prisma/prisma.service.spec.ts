import { Test } from '@nestjs/testing';

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('is injectable and exposes prisma model delegates', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const service = moduleRef.get(PrismaService);
    expect(service).toBeInstanceOf(PrismaService);
    expect(service.post).toBeDefined();
    expect(service.project).toBeDefined();
  });
});
