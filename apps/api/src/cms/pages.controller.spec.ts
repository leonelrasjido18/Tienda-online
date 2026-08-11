import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { StaticPage } from '@prisma/client';
import { expect, vi, describe, it, beforeEach } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { PagesController } from './pages.controller';

describe('PagesController', () => {
  let controller: PagesController;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PagesController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            staticPage: {
              findFirst: vi.fn(),
              findMany: vi.fn(),
              findUnique: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<PagesController>(PagesController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPage', () => {
    it('should return active page by slug', async () => {
      const pageMock = { id: '1', title: 'Ayuda', slug: 'ayuda', contentHtml: '<p>Ayuda</p>', isActive: true };
      vi.spyOn(prisma.staticPage, 'findFirst').mockResolvedValue(pageMock as unknown as StaticPage);

      const result = await controller.getPage('ayuda');

      expect(prisma.staticPage.findFirst).toHaveBeenCalledWith({
        where: { slug: 'ayuda', isActive: true },
      });
      expect(result).toEqual(pageMock);
    });

    it('should throw NotFoundException if page does not exist', async () => {
      vi.spyOn(prisma.staticPage, 'findFirst').mockResolvedValue(null);

      await expect(controller.getPage('inexistente')).rejects.toThrow(
        new NotFoundException('La página solicitada no existe'),
      );
    });
  });

  describe('adminCreatePage', () => {
    it('should create a static page with lowercase slug', async () => {
      const createMock = { id: '2', title: 'Términos', slug: 'terminos', contentHtml: 'Términos' };
      const createSpy = vi.spyOn(prisma.staticPage, 'create').mockResolvedValue(createMock as unknown as StaticPage);

      const result = await controller.adminCreatePage('Términos', ' Terminos ', 'Términos', 'Términos MD', true);

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          title: 'Términos',
          slug: 'terminos',
          contentHtml: 'Términos',
          contentMd: 'Términos MD',
          isActive: true,
        },
      });
      expect(result).toEqual(createMock);
    });
  });
});
