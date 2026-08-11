-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "customer_magic_codes" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'VERIFY_EMAIL';

-- CreateIndex
CREATE INDEX "customer_magic_codes_email_type_idx" ON "customer_magic_codes"("email", "type");

