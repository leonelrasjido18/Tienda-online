-- CreateTable
CREATE TABLE "league_fonts" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fontFileUrl" TEXT NOT NULL,
    "fillColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "strokeColor" TEXT,
    "strokeWidthPx" INTEGER NOT NULL DEFAULT 0,
    "letterSpacingPx" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_fonts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patch_leagues" (
    "patchId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,

    CONSTRAINT "patch_leagues_pkey" PRIMARY KEY ("patchId","leagueId")
);

-- CreateTable
CREATE TABLE "customization_templates" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "enableName" BOOLEAN NOT NULL DEFAULT true,
    "enableNumber" BOOLEAN NOT NULL DEFAULT true,
    "enablePatches" BOOLEAN NOT NULL DEFAULT false,
    "maxNameLength" INTEGER NOT NULL DEFAULT 12,
    "minNumber" INTEGER NOT NULL DEFAULT 1,
    "maxNumber" INTEGER NOT NULL DEFAULT 99,
    "nameExtraCents" INTEGER NOT NULL DEFAULT 0,
    "numberExtraCents" INTEGER NOT NULL DEFAULT 0,
    "fontId" TEXT,
    "namePrintArea" JSONB NOT NULL,
    "numberPrintArea" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customization_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_customization_options" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "patchId" TEXT NOT NULL,

    CONSTRAINT "product_customization_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "league_fonts_leagueId_idx" ON "league_fonts"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "customization_templates_productId_key" ON "customization_templates"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_customization_options_templateId_patchId_key" ON "product_customization_options"("templateId", "patchId");

-- AddForeignKey
ALTER TABLE "league_fonts" ADD CONSTRAINT "league_fonts_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patch_leagues" ADD CONSTRAINT "patch_leagues_patchId_fkey" FOREIGN KEY ("patchId") REFERENCES "patches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patch_leagues" ADD CONSTRAINT "patch_leagues_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_templates" ADD CONSTRAINT "customization_templates_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_templates" ADD CONSTRAINT "customization_templates_fontId_fkey" FOREIGN KEY ("fontId") REFERENCES "league_fonts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_customization_options" ADD CONSTRAINT "product_customization_options_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "customization_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_customization_options" ADD CONSTRAINT "product_customization_options_patchId_fkey" FOREIGN KEY ("patchId") REFERENCES "patches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

