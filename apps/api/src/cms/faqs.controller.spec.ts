import { Test, type TestingModule } from '@nestjs/testing';
import type { FAQ } from '@prisma/client';
import { expect, vi, describe, it, beforeEach } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { FaqsController } from './faqs.controller';

describe('FaqsController', () => {
  let controller: FaqsController;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaqsController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            fAQ: {
              findFirst: vi.fn(),
              findMany: vi.fn(),
              findUnique: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
            $transaction: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FaqsController>(FaqsController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFaqs', () => {
    it('should return only active faqs ordered by position', async () => {
      const listMock = [{ id: '1', question: 'Q1', isActive: true, position: 0 }];
      const findManySpy = vi.spyOn(prisma.fAQ, 'findMany').mockResolvedValue(listMock as unknown as FAQ[]);

      const result = await controller.getFaqs();

      expect(findManySpy).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { position: 'asc' },
      });
      expect(result).toEqual(listMock);
    });
  });

  describe('adminCreateFaq', () => {
    it('should create FAQ placing it at the last position', async () => {
      vi.spyOn(prisma.fAQ, 'findFirst').mockResolvedValue({ position: 5 } as unknown as FAQ);
      const createSpy = vi.spyOn(prisma.fAQ, 'create').mockResolvedValue({ id: 'new-faq' } as unknown as FAQ);

      await controller.adminCreateFaq('Pregunta?', 'Respuesta', 'Respuesta MD', 'envios');

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          question: 'Pregunta?',
          answerHtml: 'Respuesta',
          answerMd: 'Respuesta MD',
          category: 'envios',
          position: 6,
          isActive: true,
        },
      });
    });
  });

  describe('adminReorderFaqs', () => {
    it('should update positions of faqs in a transaction', async () => {
      const ids = ['faq-c', 'faq-a', 'faq-b'];
      const transactionSpy = vi.spyOn(prisma, '$transaction').mockResolvedValue([] as never);

      const result = await controller.adminReorderFaqs(ids);

      expect(transactionSpy).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });
});
