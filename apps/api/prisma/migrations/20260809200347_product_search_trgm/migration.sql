-- Búsqueda de productos por nombre: pg_trgm acelera tanto ILIKE '%termino%'
-- como similarity(), sin necesitar un motor de búsqueda externo.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
