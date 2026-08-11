-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- DropIndex
DROP INDEX "products_name_trgm_idx";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "defaultCity" TEXT,
ADD COLUMN     "defaultFloor" TEXT,
ADD COLUMN     "defaultNotes" TEXT,
ADD COLUMN     "defaultNumber" TEXT,
ADD COLUMN     "defaultPickupInStore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultPostalCode" TEXT,
ADD COLUMN     "defaultProvince" TEXT,
ADD COLUMN     "defaultStreet" TEXT,
ADD COLUMN     "referralBalanceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "couponId" TEXT,
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "customer_magic_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "customer_magic_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "static_pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "contentMd" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "static_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answerHtml" TEXT NOT NULL,
    "answerMd" TEXT,
    "category" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minPurchaseCents" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_customer_uses" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_customer_uses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rewards" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "rewardCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "static_pages_slug_key" ON "static_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_customer_uses_orderId_key" ON "coupon_customer_uses"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_customer_uses_couponId_customerId_orderId_key" ON "coupon_customer_uses"("couponId", "customerId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_rewards_referredId_key" ON "referral_rewards"("referredId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_referralCode_key" ON "customers"("referralCode");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_customer_uses" ADD CONSTRAINT "coupon_customer_uses_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_customer_uses" ADD CONSTRAINT "coupon_customer_uses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
