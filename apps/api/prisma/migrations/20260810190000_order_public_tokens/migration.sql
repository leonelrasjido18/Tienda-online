-- Los UUID internos no deben convertirse en credenciales públicas. Cada pedido
-- recibe un token independiente y no predecible para su vista de cliente.
ALTER TABLE "orders" ADD COLUMN "publicToken" TEXT;

UPDATE "orders"
SET "publicToken" = md5(id || clock_timestamp()::text || random()::text)
WHERE "publicToken" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "publicToken" SET NOT NULL;
CREATE UNIQUE INDEX "orders_publicToken_key" ON "orders"("publicToken");
