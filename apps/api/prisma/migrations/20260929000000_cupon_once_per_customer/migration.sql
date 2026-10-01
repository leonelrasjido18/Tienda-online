-- Permite limitar un cupón a un uso por cliente. Los cupones existentes quedan
-- sin la restricción, que es como venían funcionando.
ALTER TABLE "coupons" ADD COLUMN "oncePerCustomer" BOOLEAN NOT NULL DEFAULT false;
