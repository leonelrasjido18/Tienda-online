# Plan de continuación — Remeras del Área

> **Documento de traspaso** para que otro agente continúe sin haber participado del
> desarrollo. La sección "Convenciones y trampas" es obligatoria: casi todo ahí costó
> horas de depuración y no se deduce leyendo el código.
>
> **Copiar este archivo a `docs/PLAN.md` dentro del repo** para que quede versionado.

---

## Contexto

**Remeras del Área** es una tienda de camisetas de fútbol importadas desde China, para una
clienta en Argentina. Tres cosas la separan de un e-commerce común: doble modalidad (stock
inmediato y por encargo), personalización con nombre y dorsal (con PNG de producción para el
proveedor), y pago en dos etapas (seña al comprar, saldo + envío al llegar el lote).

### Estado actual

| Fase | Estado |
|---|---|
| 0 Fundaciones · 1 Catálogo · 2 Personalizador | ✅ |
| 3 Carrito, checkout, seña, notificaciones | ✅ |
| 4 Lotes de importación y cobro del saldo | ✅ |
| 5 Cancelaciones, reembolsos, envíos, remitos | ✅ |
| Identidad de marca, home, contenido, SEO, mobile | ✅ |
| Pasarela intercambiable (Ualá activo, MP disponible) | ✅ |
| **6 Cuentas de cliente y CMS** | ⬜ |
| **7 Marketing y conversión** | ⬜ |
| **8 Producción y endurecimiento** | ⬜ |

**Todo está commiteado** (último: `f535dce`). El árbol está limpio y la app corre: API 3001,
storefront 3000, admin 3002. `pnpm lint`, `test` (54), `test:e2e` (19) y `build` en verde.

### La auditoría de seguridad

`INFORME_AUDITORIA.md` (en la raíz) documenta 18 hallazgos. La **Fase 0 de contención está
cerrada**: RBAC con matriz de permisos y 12 pruebas, token público por pedido, cobro atómico
con `FOR UPDATE`, validación de monto/moneda/proveedor en webhooks, carrito preservado si
falla la pasarela, rate limiting global, helmet, escape de HTML en correos, validación de
firma real de archivos y dependencias parcheadas (de 6 vulnerabilidades altas a 1).

**Lo que sigue abierto está en el Bloque A y va antes que las fases nuevas.**

---

## Convenciones y trampas del proyecto

### Entorno (Windows)

1. **Los procesos node bloquean el motor de Prisma.** Antes de `prisma generate` o
   `pnpm install`: `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force`.
   Matar la tarea de `pnpm dev` no mata los hijos.
2. **Next.js 16 en dev usa `--webpack`.** Turbopack rompe en rutas dinámicas. No quitarlo.

### Migraciones — nunca `migrate dev` (se cuelga)

```bash
cp apps/api/prisma/schema.prisma /tmp/schema-before.prisma   # 1. copiar ANTES de editar
# 2. editar el schema
npx prisma migrate diff --from-schema-datamodel /tmp/schema-before.prisma \
  --to-schema-datamodel prisma/schema.prisma --script > \
  prisma/migrations/<TIMESTAMP>_<nombre>/migration.sql       # 3. generar SQL
npx prisma migrate deploy && npx prisma generate             # 4. APLICAR
```

⚠️ El timestamp debe ser **mayor** al último o `migrate deploy` la ignora. Última aplicada:
`20260810190000_order_public_tokens`.

⚠️ **Terminar siempre con `npx prisma migrate status`.** Este paso ya se saltó una vez y dejó
el proyecto sin arrancar: el código usaba una columna que no existía en la base.

### Paquetes compartidos

- **`@tienda/shared` se consume vía `dist/`**: correr `pnpm --filter @tienda/shared build`
  antes de typecheckear las apps, o los errores de tipo son confusos.
- **`@tienda/ui` es fuente TS sin build**: los cambios se ven al instante.

### Prisma

- **`import type { Prisma }` rompe en runtime** si se usan `Prisma.DbNull`, `Prisma.JsonNull`,
  `Prisma.join` o `Prisma.sql`. Esos necesitan import de valor. Falla al ejecutar, no al compilar.
- **`DbNull`** = NULL de SQL; **`JsonNull`** = literal JSON `null`. En filtros WHERE hay que
  envolverlo: `{ campo: { equals: Prisma.DbNull } }`.

### Validación y permisos

- `ZodValidationPipe` con `@UsePipes()` corre para **todos** los parámetros, incluidos los
  `@Param`. Por eso filtra por `metadata.type !== 'body'`. No romper ese guard.
- `RolesGuard` tiene **deny-by-default**: todo `/admin/*` exige `OWNER` salvo que el
  controlador declare `@Roles`. Al agregar un controlador de administración hay que anotarlo
  o queda accesible sólo para la dueña.
- Matriz vigente: **STAFF** opera el día a día (catálogo, pedidos, lotes, producción);
  **OWNER** además es el único que toca plata y configuración (reembolsos, cancelaciones,
  aprobar transferencias, marcar saldos cobrados, ajustes, tarifas). Fijada en
  `apps/api/test/roles.e2e-spec.ts`.

### Patrones a reutilizar

- **Proveedor intercambiable por variable de entorno.** Ya usado dos veces:
  `apps/api/src/shipping/shipping-provider.interface.ts` (manual, andreani) y
  `apps/api/src/sales/payments/payment-provider.interface.ts` (mercadopago, uala, con
  `payment-provider.registry.ts`). Los inactivos siguen registrados para procesar webhooks viejos.
- **Plata siempre en centavos enteros.** Formateo con `formatCentsAsArs` / `parseArsToCents`
  de `packages/shared/src/lib/money.ts`. Nunca floats.
- **Zod en `packages/shared`**, consumido por API y ambos frontends.
- **Nunca confiar en el cuerpo de un webhook**: verificar firma si existe, **reconsultar** el
  estado al proveedor, y validar monto/moneda/referencia contra el `Payment` local.
- **Colores de marca**: sólo en el bloque `MARCA` de `packages/ui/src/styles.css`. Azul
  `hsl(224 92% 50%)` ≈ `#0A49F5`.
- Storefront: `apiFetchSafe` (no tumba la página si la API falla) y `resolveImageUrl()`.

### Frontend

- Las fotos las sirve la API. `next/image` necesita `remotePatterns` y
  `dangerouslyAllowLocalIP` en dev (ya configurado en `apps/storefront/next.config.ts`).
- Tema: `@custom-variant dark` + atributo `data-theme` + script anti-FOUC. **No** usar `.dark`.
- Un SVG cargado con `<img src>` no hereda `currentColor` (por eso el logo va inline).

### Ualá Bis

- **Rechaza URLs de `localhost`**: para probar webhooks en dev hace falta un túnel (ngrok)
  apuntando `STOREFRONT_URL` y `API_PUBLIC_URL` a la URL pública.
- **Sus webhooks no tienen firma.** La defensa es la reconsulta a `GET /orders/:uuid`. **No
  debilitarla.**
- Credenciales de prueba cargadas (`UALA_ENV=stage`). Pendiente: pagar con la tarjeta
  `4507 9900 0000 4905` (08/30, CVV 123) y confirmar que el webhook marca el pedido pagado.

---

## Bloque A — Cerrar la auditoría (antes de producción)

### A1. Rate limiting por endpoint
Hoy sólo hay un límite global de 100 req/min. Los endpoints caros o atacables necesitan
límites propios con `@Throttle`: `/auth/login` y `/auth/refresh` (fuerza bruta), `/checkout`
(creación masiva de pedidos), `/catalog/*/customize/render` (render de imágenes, consume CPU),
`/balance/:token/pay` y los webhooks. Agregar CAPTCHA progresivo en login y checkout.

### A2. Reintento idempotente de pago
Si la pasarela falla, el carrito se conserva y la reserva se libera, pero la persona no puede
retomar el pedido pendiente: tiene que empezar de nuevo. Falta un endpoint que, dado un pedido
`PENDING` no vencido, regenere el checkout contra la pasarela y devuelva el `redirectUrl`.
Usar una clave de idempotencia del cliente para que dos clics no creen dos órdenes.

### A3. Máquina de estados de `Payment`, `Order` y `PaymentLink`
Hoy las transiciones están dispersas y hay guardas puntuales (`if payment.status === 'APPROVED' return`).
Definir explícitamente las transiciones permitidas —como ya se hizo con `canTransition` para
los lotes en `packages/shared/src/schemas/import/batch.schema.ts`— y aplicarlas en un solo
lugar. Cubre el caso de aprobación y expiración concurrentes.

### A4. nodemailer 9.x
Queda 1 vulnerabilidad alta. La rama 9.x trae cambios de API: migrar con pruebas de envío
reales contra Mailpit (`:8025`) antes de dar por hecho que funciona.

### A5. CI que bloquee de verdad
Tres agujeros en `.github/workflows/ci.yml`:
- Declara `REDIS_URL` pero **no levanta el servicio Redis**, y `AppModule` configura BullMQ ahí.
- `admin` y `storefront` **no tienen scripts `typecheck` ni `test`**, así que `pnpm typecheck`
  no verifica ningún frontend.
- No corre `pnpm audit`. Agregarlo y que falle el merge si aparece una vulnerabilidad alta.

---

## Bloque B — Fase 6: Cuentas de cliente y contenido

**Decisión tomada**: cuentas completas con registro y contraseña.

### B1. Cuentas
Extender `Customer` (hoy sólo email/name/phone) con `passwordHash` y `emailVerifiedAt`.
Registro, verificación por email, login y recuperación de contraseña.

**Reusar el patrón de auth de staff** (`apps/api/src/auth/`): JWT de acceso corto + refresh
rotativo en cookie httpOnly con detección de reuso. **No inventar un esquema nuevo**, pero
mantener a los clientes en un espacio separado del staff — un `Customer` nunca debe poder
tocar `/admin/*`.

Modelo `Address` para direcciones guardadas (la dirección dentro de `Order` se mantiene como
snapshot histórico). Al hacer checkout logueado, asociar el pedido al `customerId` y ofrecer
sus direcciones. Fusionar el carrito anónimo al loguearse (`Cart.customerId` ya existe).

### B2. "Mi cuenta"
Historial de pedidos, estado del encargo (traducir el estado del `ImportBatch` a lenguaje de
cliente con `IMPORT_BATCH_STATUS_LABELS`), saldos pendientes con su link, direcciones y favoritos.

### B3. CMS
Modelos `Page`, `Banner` (con vigencia programada) y `MenuItem`. Migrar las 7 páginas de
contenido de `apps/storefront/src/content/` a contenido editable **manteniendo las mismas URLs**.
Personalización de marca desde el panel escribiendo sobre las variables del bloque `MARCA`.

⚠️ **Sanitizar el HTML del CMS**: `dangerouslySetInnerHTML` sin sanitizar es XSS directo.

### B4. SEO restante
Ya existen sitemap, robots, OpenGraph y metadata por página. Falta JSON-LD `Product` con
precio y disponibilidad, canónicas en listados filtrados, y sumar las páginas del CMS al sitemap.

---

## Bloque C — Fase 7: Marketing y conversión

- **Cupones** con restricciones (monto mínimo, vigencia, límite de usos, productos aplicables,
  y exclusión de productos por encargo si la clienta quiere). Aplicar **siempre del lado del
  servidor**: nunca confiar en el precio que manda el cliente.
- **Carritos abandonados**: jobs de BullMQ a 4 h, 24 h y 72 h, con link que **conserva la
  personalización** (`customizationDraft` ya vive en `CartItem`).
- **Reseñas** con moderación, sólo de compradores verificados (con un pedido `PAID` de ese producto).
- **Colecciones y relacionados**: `Collection` y `ProductCollection` ya existen migrados y
  huérfanos — sólo falta el CRUD y los endpoints.
- **Analítica**: GA4 + Meta Pixel + Conversions API server-side. Feed para Google Merchant.
- **Dashboard**: ventas por día, ticket promedio, más vendidos, stock crítico y sobre todo
  **demanda por encargo acumulada** — qué se pide más sin stock, para decidir el próximo lote.
  Es la métrica que más le sirve al negocio.

---

## Bloque D — Fase 8: Producción

**No existe nada de infraestructura**: sin Dockerfiles, sin compose de producción, sin Nginx,
sin deploy. Se construye desde cero.

- **Containerización**: `Dockerfile` multi-stage por app + `.dockerignore`.
  `docker/docker-compose.prod.yml` con Nginx y Certbot. Tres dominios: tienda, admin, api.
  Deploy por GitHub Actions vía SSH.
  ⚠️ El entrypoint de la API es `dist/main.js`; `tsconfig.build.json` ya está corregido para
  que no anide en `dist/src/`. No revertirlo.
- **Backups**: `pg_dump` diario cifrado + las imágenes de `uploads/`. **Probar la restauración
  en una base limpia**: un backup sin restauración probada no es un backup.
- **Seguridad de despliegue**: endurecer la validación de entorno para que en producción no se
  acepten secretos de desarrollo ni URLs no-HTTPS; migrar secretos a un vault; `trust proxy`;
  no exponer Postgres ni Redis; cifrar credenciales de proveedores en base (AES-256-GCM).
- **Observabilidad**: hoy no hay nada. Pino con request IDs, Sentry, `/health` separado en
  readiness y liveness chequeando **también Redis** (hoy sólo mira Postgres). Outbox + reintentos
  con backoff para correos y push, que hoy sólo se loguean si fallan.
- **Performance y e2e**: Lighthouse ≥ 90 mobile, AVIF, ISR en fichas. Playwright cubriendo la
  compra en las dos modalidades.
- **Entrega**: video corto + guía escrita para la clienta (cargar producto, generar variantes,
  definir zonas de impresión, armar lote, marcarlo recibido y cobrar el saldo).

---

## Pruebas que faltan (orden de prioridad, según la auditoría)

Hoy hay 54 unitarias y 19 e2e. Las e2e cubren auth, rutas públicas y permisos por rol. **No
cubren dinero ni inventario**, que es donde más duele una regresión:

1. Dos webhooks simultáneos del mismo pago → **un solo** movimiento `SALE` y un solo decremento.
2. Aprobación y expiración concurrentes → un único estado coherente, stock nunca negativo.
3. Error o timeout al crear el checkout → carrito conservado y reintento idempotente.
4. Webhook con monto, moneda, referencia o proveedor distintos → rechazado sin tocar la orden.
5. Archivos falsos, corruptos o sobredimensionados → rechazados sin bloquear el proceso.
6. E2E completo: carrito → checkout → webhook → despacho, y seña → saldo → pago final.

---

## Verificación

Después de **cada** bloque:

```bash
pnpm --filter @tienda/shared build   # si se tocó shared
npx prisma migrate status            # si se tocó el schema
pnpm lint && pnpm test && pnpm test:e2e && pnpm build
```

Y levantar de verdad (`pnpm dev`) confirmando que responden API (3001), storefront (3000) y
admin (3002). Que los tests pasen no alcanza: el proyecto ya quedó sin arrancar una vez con
todo en verde, por una migración sin aplicar.

**Antes de anunciar**: recorrido completo en un celular real, en tema claro y oscuro —
home → liga → producto → personalizar → carrito → checkout con seña → confirmación → marcar
lote recibido → email de saldo → pagar saldo → despacho con tracking. Más una compra real de
bajo monto en producción, en cada modalidad.

**Criterio de salida a producción** (de la auditoría): sin vulnerabilidades altas conocidas,
todos los endpoints administrativos con permisos probados, acceso público a pedidos tokenizado,
pagos idempotentes bajo concurrencia y el pipeline obligatorio en verde.

---

## Pendientes que dependen de la clienta

| Qué | Bloquea |
|---|---|
| Credenciales de producción de Ualá (**regenerar las que se expusieron en una captura**) | Cobrar de verdad |
| Dominio y VPS | Todo el Bloque D |
| Cuenta y credenciales de Andreani | Cotización automática (hay fallback manual funcionando) |
| Tipografías oficiales por liga y PNG de parches | Personalización realista |
| Revisión de los textos legales marcados **BORRADOR** en `apps/storefront/src/content/` | Vender con seña sin riesgo legal |
| Definir si absorbe el CFT de cuotas sin interés (3 cuotas = 10% + IVA, sobre 4,9% de comisión) | Su margen real |
