-- AlterTable
ALTER TABLE "customization_templates" ADD COLUMN     "fillColor" TEXT NOT NULL DEFAULT '#FFFFFF',
ADD COLUMN     "letterSpacingPx" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "strokeColor" TEXT,
ADD COLUMN     "strokeWidthPx" INTEGER NOT NULL DEFAULT 0;


-- Backfill: los productos que ya tenían fuente asignada conservan su estilo,
-- copiando color/contorno/interletrado desde la fuente hacia la plantilla.
UPDATE "customization_templates" ct
SET "fillColor"       = lf."fillColor",
    "strokeColor"     = lf."strokeColor",
    "strokeWidthPx"   = lf."strokeWidthPx",
    "letterSpacingPx" = lf."letterSpacingPx"
FROM "league_fonts" lf
WHERE ct."fontId" = lf."id";
