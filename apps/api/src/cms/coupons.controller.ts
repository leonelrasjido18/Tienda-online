import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  UsePipes,
} from '@nestjs/common';
import { upsertCouponSchema, type UpsertCouponInput } from '@tienda/shared';
import { Prisma } from '@prisma/client';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/coupons')
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista todos los cupones ordenados por fecha de creación. */
  @Get()
  async listCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { orders: true } },
      },
    });
  }

  /** Obtiene un cupón por ID. */
  @Get(':id')
  async getCoupon(@Param('id') id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
      },
    });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');
    return coupon;
  }

  /**
   * Crea un cupón. La validación la hace `upsertCouponSchema`: antes esto
   * recibía el cuerpo sin revisar (la `interface` de TypeScript no existe en
   * runtime) y aceptaba un porcentaje de 150, que generaba pedidos con total
   * negativo.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(upsertCouponSchema))
  async createCoupon(@Body() body: UpsertCouponInput) {
    try {
      return await this.prisma.coupon.create({ data: this.toData(body) });
    } catch (error) {
      throw this.traducirError(error, body.code);
    }
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertCouponSchema))
  async updateCoupon(@Param('id') id: string, @Body() body: UpsertCouponInput) {
    try {
      return await this.prisma.coupon.update({ where: { id }, data: this.toData(body) });
    } catch (error) {
      throw this.traducirError(error, body.code);
    }
  }

  /** Elimina un cupón. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCoupon(@Param('id') id: string) {
    await this.prisma.coupon.delete({ where: { id } });
  }

  private toData(body: UpsertCouponInput) {
    return {
      code: body.code.toUpperCase().trim(),
      type: body.type,
      value: body.value,
      minPurchaseCents: body.minPurchaseCents,
      maxUses: body.maxUses ?? null,
      oncePerCustomer: body.oncePerCustomer,
      expiresAt: body.expiresAt ?? null,
      isActive: body.isActive,
    };
  }

  /** El código es único: sin esto, repetirlo devolvía un 500. */
  private traducirError(error: unknown, code: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`Ya existe un cupón con el código ${code.toUpperCase()}`);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return new NotFoundException('Cupón no encontrado');
    }
    return error;
  }
}
