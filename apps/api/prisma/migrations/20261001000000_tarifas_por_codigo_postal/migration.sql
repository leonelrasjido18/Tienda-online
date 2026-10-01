-- DropIndex
DROP INDEX "shipping_rates_province_key";

-- AlterTable
ALTER TABLE "shipping_rates" ADD COLUMN     "postalCode" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "shipping_rates_postalCode_idx" ON "shipping_rates"("postalCode");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_rates_province_postalCode_key" ON "shipping_rates"("province", "postalCode");

