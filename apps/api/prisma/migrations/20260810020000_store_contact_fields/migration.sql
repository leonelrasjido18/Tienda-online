-- Store contact fields for footer, WhatsApp links, and pickup location
ALTER TABLE "store_settings" ADD COLUMN "whatsappPhone" TEXT;
ALTER TABLE "store_settings" ADD COLUMN "whatsappMessage" TEXT;
ALTER TABLE "store_settings" ADD COLUMN "instagramUser" TEXT;
ALTER TABLE "store_settings" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "store_settings" ADD COLUMN "pickupAddress" TEXT;
ALTER TABLE "store_settings" ADD COLUMN "openingHours" TEXT;
