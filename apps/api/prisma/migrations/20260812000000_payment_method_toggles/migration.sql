-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "enableBankTransfer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableCardPayment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableCash" BOOLEAN NOT NULL DEFAULT false;

