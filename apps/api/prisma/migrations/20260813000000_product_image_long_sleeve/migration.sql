-- Marca una foto del producto como la versión de mangas largas.
ALTER TABLE "product_images" ADD COLUMN "isLongSleeve" BOOLEAN NOT NULL DEFAULT false;
