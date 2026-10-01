-- Descuento por pagar sin pasarela (transferencia o efectivo). Arranca en cero:
-- las tiendas existentes no cambian de comportamiento hasta configurarlo.
ALTER TABLE "store_settings"
  ADD COLUMN "bankTransferDiscountMode"  TEXT    NOT NULL DEFAULT 'percentage',
  ADD COLUMN "bankTransferDiscountValue" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cashDiscountMode"          TEXT    NOT NULL DEFAULT 'percentage',
  ADD COLUMN "cashDiscountValue"         INTEGER NOT NULL DEFAULT 0;

-- Cuánto se descontó por el medio de pago, aparte del cupón: si se mezclaran en
-- el mismo campo no se podría saber cuánto se regaló por cada motivo.
ALTER TABLE "orders"
  ADD COLUMN "paymentDiscountCents" INTEGER NOT NULL DEFAULT 0;
