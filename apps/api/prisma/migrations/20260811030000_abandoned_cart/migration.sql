-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "abandonedStage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAbandonedReminderAt" TIMESTAMP(3);

