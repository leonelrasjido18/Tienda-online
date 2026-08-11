import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateCouponInput {
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  value: number;
  minPurchaseCents?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

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

  /** Crea un nuevo cupón de descuento. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCoupon(@Body() body: CreateCouponInput) {
    return this.prisma.coupon.create({
      data: {
        code: body.code.toUpperCase().trim(),
        type: body.type,
        value: body.value,
        minPurchaseCents: body.minPurchaseCents ?? 0,
        maxUses: body.maxUses ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });
  }

  /** Actualiza un cupón existente. */
  @Put(':id')
  async updateCoupon(
    @Param('id') id: string,
    @Body() body: CreateCouponInput,
  ) {
    return this.prisma.coupon.update({
      where: { id },
      data: {
        code: body.code.toUpperCase().trim(),
        type: body.type,
        value: body.value,
        minPurchaseCents: body.minPurchaseCents ?? 0,
        maxUses: body.maxUses ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });
  }

  /** Elimina un cupón. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCoupon(@Param('id') id: string) {
    await this.prisma.coupon.delete({ where: { id } });
  }
}
