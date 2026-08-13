-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minUnits" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "promisedDeliveryDays" INTEGER;

