import { Injectable } from '@nestjs/common';
import type {
  PaymentDiscountMode,
  PaymentDiscountSettings,
  UpdateStoreSettingsInput,
} from '@tienda/shared';
import type { StoreSettings } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const existing = await this.prisma.storeSettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return this.prisma.storeSettings.create({ data: { id: 1 } });
  }

  /**
   * El descuento por medio de pago se guarda en columnas planas pero se edita y
   * se consume como un objeto por medio. La traducción vive acá y no en cada
   * consumidor, para que no haya dos formas de leer lo mismo.
   */
  static toPaymentDiscounts(settings: StoreSettings): PaymentDiscountSettings {
    return {
      bank_transfer: {
        mode: settings.bankTransferDiscountMode as PaymentDiscountMode,
        value: settings.bankTransferDiscountValue,
      },
      cash: {
        mode: settings.cashDiscountMode as PaymentDiscountMode,
        value: settings.cashDiscountValue,
      },
    };
  }

  async paymentDiscounts(): Promise<PaymentDiscountSettings> {
    return SettingsService.toPaymentDiscounts(await this.get());
  }

  async update(input: UpdateStoreSettingsInput) {
    await this.get();

    const { bankTransferDiscount, cashDiscount, ...resto } = input;

    return this.prisma.storeSettings.update({
      where: { id: 1 },
      data: {
        ...resto,
        ...(bankTransferDiscount
          ? {
              bankTransferDiscountMode: bankTransferDiscount.mode,
              bankTransferDiscountValue: bankTransferDiscount.value,
            }
          : {}),
        ...(cashDiscount
          ? { cashDiscountMode: cashDiscount.mode, cashDiscountValue: cashDiscount.value }
          : {}),
      },
    });
  }
}
