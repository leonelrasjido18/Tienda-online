-- AlterTable
ALTER TABLE "customization_templates" ADD COLUMN     "customizationImageId" TEXT;

-- AddForeignKey
ALTER TABLE "customization_templates" ADD CONSTRAINT "customization_templates_customizationImageId_fkey" FOREIGN KEY ("customizationImageId") REFERENCES "product_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

