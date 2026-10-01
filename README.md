# Tienda online — guía de implementación

> **Este archivo está escrito para que lo lea Claude (o cualquier agente) antes de tocar el
> proyecto, y para poder montar la misma tienda para otro cliente.** No es un folleto: es el
> manual de operaciones. Si algo acá contradice al código, **gana el código** — y entonces hay
> que corregir este archivo en el mismo cambio.

La plantilla es un e-commerce completo de indumentaria deportiva importada, en producción desde
agosto de 2026 para una clienta en Argentina (camisetas de fútbol). Tres cosas lo separan de un
e-commerce común, y explican casi todas las decisiones del código:

1. **Doble modalidad de entrega.** Un producto puede venderse con stock inmediato, por encargo
   al proveedor, o las dos cosas a la vez.
2. **Pago en dos etapas.** Si el pedido incluye algo por encargo, se cobra una seña al comprar y
   el saldo (más el envío) cuando el lote llega al país.
3. **Personalización.** Nombre y dorsal sobre la prenda, con render de una imagen de producción
   para mandarle al proveedor.

---

## 0. Cómo usar este archivo

**Antes de escribir una línea de código:**

1. Leé entero el capítulo **5 (Convenciones no negociables)**. Cada punto ahí está porque costó
   horas de depuración o porque rompió producción. Ninguno se deduce leyendo el código.
2. Leé el capítulo **2 (Modelo de negocio)**. Sin eso, los nombres del dominio
   (`DEPOSIT_BALANCE`, `AWAITING_IMPORT`, `PaymentLink`) no significan nada y se escriben bugs
   de plata.
3. Si vas a montar la tienda para un cliente nuevo, el capítulo **4** es la checklist completa.
4. Antes de decir que terminaste, corré lo del capítulo **7**. No alcanza con que compile.

**Dos reglas de oro, sobre todo lo demás:**

- **La plata se mueve en centavos enteros.** Nunca un float, nunca un `number` con decimales.
  Formateo con `formatCentsAsArs` / `parseArsToCents` de
  [money.ts](packages/shared/src/lib/money.ts).
- **Nada que afecte un precio se calcula en el cliente.** El navegador propone; el servidor
  recalcula y decide. Un precio que llega en el cuerpo de un request se ignora.

---

## 1. Arranque local

Requisitos: **Node ≥ 20**, **pnpm 9.15**, **Docker** (para Postgres, Redis y el servidor de
correo de prueba).

```bash
pnpm install                       # el postinstall corre prisma generate
pnpm infra:up                      # postgres:5432, redis:6379, mailpit:1025 (UI en :8025)
cp apps/api/.env.example apps/api/.env
pnpm db:migrate                    # aplica el schema
pnpm db:seed                       # datos de demo + usuario owner@tienda.local / changeme123
pnpm dev                           # API 3001 · tienda 3000 · panel 3002
```

Los correos que manda la app en desarrollo **no salen a internet**: quedan en Mailpit, que se
mira en <http://localhost:8025>.

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Las tres apps en paralelo (turbo) |
| `pnpm lint` | ESLint en todo el monorepo, `--max-warnings 0` en la API |
| `pnpm typecheck` | `tsc --noEmit` en las tres apps y los dos paquetes |
| `pnpm test` | Unitarias (vitest) |
| `pnpm test:e2e` | E2E de la API: auth, rutas públicas, permisos por rol, concurrencia de pagos |
| `pnpm build` | Build de producción de todo |
| `pnpm db:studio` | Prisma Studio para mirar la base |

---

## 2. Modelo de negocio

Esto es lo que hay que entender antes de tocar `sales/`.

### Doble modalidad

Cada producto tiene un `fulfillmentMode`: `IN_STOCK`, `PREORDER` o `BOTH`. En la ficha, quien
compra elige; si el producto es `BOTH` y hay stock del talle elegido, puede llevarlo ya o
pedirlo en el próximo lote (normalmente más barato).

### Pago en dos etapas

[`calculatePaymentPlan()`](packages/shared/src/lib/payment-plan.ts) decide el plan de todo el
pedido con una sola regla: **si al menos un ítem quedó como `PREORDER`, el pedido entero pasa a
seña + saldo.**

| Plan | Cuándo | Qué se cobra al comprar |
|---|---|---|
| `FULL` | Todo con stock inmediato | El total |
| `DEPOSIT_BALANCE` | Hay al menos un encargo | Sólo la seña (un % configurable) |

El envío **nunca** entra en la seña: se cotiza recién cuando el lote llega, porque hasta
entonces no se sabe el peso ni el destino final.

Los estados reflejan eso, y están en
[order.schema.ts](packages/shared/src/schemas/sales/order.schema.ts):

```
financialStatus:   PENDING → DEPOSIT_PAID → AWAITING_BALANCE → PAID
                           ↘ PARTIALLY_REFUNDED / REFUNDED / FAILED / EXPIRED
fulfillmentStatus: UNFULFILLED → AWAITING_IMPORT → READY → FULFILLED / CANCELLED
```

### Lotes de importación

Un `ImportBatch` agrupa los pedidos por encargo de un período. El flujo que opera el dueño es:
abrir el lote → acumular pedidos → marcarlo pedido al proveedor → marcarlo recibido → el sistema
genera un **link de cobro del saldo** (`PaymentLink`, con vencimiento) y manda el correo a cada
cliente. Hay recordatorios automáticos por BullMQ para los saldos sin pagar.

La planilla de producción (`import/production-sheet.*`) es lo que se le manda al proveedor: qué
camiseta, qué talle, y el PNG de la personalización de cada una.

### Personalización

Una plantilla por producto define las zonas de impresión (dónde va el nombre, dónde el dorsal),
la tipografía y el color. El cliente escribe su nombre y número, ve una previsualización, y al
comprar se guarda un `OrderItemCustomization` con el render de producción.

**El precio de la personalización es uno solo, no se cobra por separado.** Poner nombre, poner
dorsal, o poner los dos cuesta lo mismo. Está en
[customization-price.ts](packages/shared/src/lib/customization-price.ts) y es un requisito
explícito del negocio: antes se cobraba doble y hubo que corregirlo.

---

## 3. Mapa del repo

Monorepo pnpm + turbo.

```
apps/
  api/          NestJS 10 + Prisma 6 + Postgres 16 + Redis (BullMQ). Puerto 3001.
  storefront/   Next 16 (App Router) + Tailwind 4. La tienda. Puerto 3000.
  admin/        Next 16 + Tailwind 4. El panel de gestión. Puerto 3002.
packages/
  shared/       Zod + funciones puras de negocio. Lo consumen la API y los dos frontends.
  ui/           Componentes compartidos (shadcn-style) + el tema. Fuente TS, sin build.
  eslint-config/
docker/         Dockerfiles, compose de producción, nginx, backup y el runbook de deploy.
ops/            Scripts que corren en el servidor (backup, restore).
docs/           Checklist de lo que hay que conseguir del cliente para el deploy.
```

### Dentro de `apps/api/src`

| Carpeta | De qué se ocupa |
|---|---|
| `auth/` | Login del staff: JWT corto + refresh rotativo en cookie httpOnly con detección de reuso |
| `catalog/products/` | Productos, opciones, variantes, generador de variantes, edición masiva, ajuste masivo de precios |
| `catalog/customization/` | Plantillas, tipografías, parches, render del estampado, análisis con IA |
| `catalog/public/` | Lo que consume la tienda: listado, facetas, buscador, ficha |
| `catalog/taxonomies/` | Ligas, equipos, temporadas, categorías, marcas, colecciones |
| `sales/cart/` | Carrito y recupero de carritos abandonados (BullMQ) |
| `sales/checkout/` | Creación de la orden en una transacción, con reserva de stock |
| `sales/orders/` | Ciclo de vida del pedido, webhooks de pago, reembolsos, despacho |
| `sales/payments/` | Pasarelas intercambiables (Mercado Pago, Ualá Bis) |
| `sales/notifications/` | Correos (plantillas editables desde el panel) y push al dueño |
| `sales/customers-auth/` | Cuentas de cliente, separadas del staff |
| `sales/settings/` | Configuración de la tienda que el dueño edita |
| `import/` | Lotes, cobro del saldo, recordatorios, planilla de producción |
| `shipping/` | Proveedores intercambiables (manual por tabla, Andreani, Correo Argentino) |
| `cms/` | Páginas, FAQ, cupones, dashboard |
| `common/` | `ZodValidationPipe`, filtro de excepciones, Turnstile |

### El panel

`/dashboard` + secciones: productos (y alta/edición), edición masiva, precios, categorías,
ligas, equipos, temporadas, marcas, colecciones, parches, tipografías, pedidos (y detalle),
lotes (y detalle), cupones, envíos, correos, preguntas, reseñas, ajustes.

---

## 4. Replicar para un cliente nuevo

El proyecto está hecho para esto, pero hay identidad del cliente actual incrustada en lugares
concretos. **Esta es la lista completa** — se verificó con `git grep`, no es de memoria.

### 4.1 Marca e identidad

| Qué cambiar | Dónde |
|---|---|
| Nombre, descripción, locale, moneda | [site-config.ts](apps/storefront/src/lib/site-config.ts) |
| Colores del tema | Bloque `MARCA` al principio de [styles.css](packages/ui/src/styles.css) — **es el único lugar** |
| Logo | `apps/storefront/src/components/` (va **inline**, ver 5.6) e íconos en `apps/*/public/` |
| Filas de productos del home | `HOME_RAILS` en [site-config.ts](apps/storefront/src/lib/site-config.ts) |
| Marca del feed de Google Merchant | Variable `MERCHANT_FEED_BRAND` |
| Ejemplos de los correos | [email-preview-samples.ts](apps/api/src/sales/notifications/email-preview-samples.ts) (tiene el dominio actual) |
| Datos de contacto por defecto | [seed.ts](apps/api/prisma/seed.ts) — o mejor: cargarlos desde el panel en Ajustes |
| Dominios | [nginx-remerasdelarea.conf](docker/nginx-remerasdelarea.conf) y [DEPLOY-RUNBOOK.md](docker/DEPLOY-RUNBOOK.md) |

Los textos legales, la guía de talles y el "cómo funciona" viven en
`apps/storefront/src/content/`. **Varios están marcados `BORRADOR` y hay que validarlos con el
cliente antes de publicar**: son los que te comprometen legalmente al vender con seña.

### 4.2 Decisiones que el cliente tiene que tomar

Preguntale esto antes de empezar, porque cambia el código:

- ¿Vende con doble modalidad o sólo stock inmediato? **Si es sólo stock inmediato, todo el
  aparato de lotes, seña/saldo y `PaymentLink` queda sin usar.** No lo borres: desactivalo
  poniendo todos los productos en `IN_STOCK`. Borrarlo es mucho trabajo y se pierde si después
  lo quiere.
- ¿Hay personalización de la prenda? Si no, `catalog/customization/` queda sin usar.
- ¿Qué porcentaje de seña?
- ¿Qué pasarela: Mercado Pago o Ualá Bis? (es una variable de entorno, ver 5.7)
- ¿Cotiza envíos por API (Andreani / Correo Argentino) o con una tabla de tarifas por provincia
  cargada a mano? El modo manual no depende de nadie y es el que menos problemas da.
- ¿Ofrece descuento por transferencia o efectivo? Se configura en el panel, no en código.

### 4.3 Qué conseguir del cliente

La lista operativa está en [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md). El resumen:

- Dominio y acceso a su DNS.
- VPS (con lo que hay alcanza: Ubuntu 24.04, Docker).
- Credenciales de **producción** de la pasarela de pago.
- Un SMTP real con el dominio verificado (SPF, DKIM, DMARC). En desarrollo se usa Mailpit, pero
  sin verificar el dominio los correos de producción caen en spam.
- Claves de Cloudflare Turnstile.
- Si hay personalización: tipografías con licencia y los PNG de los parches.
- Los textos legales revisados.

### 4.4 Primer deploy

Seguí [docker/DEPLOY-RUNBOOK.md](docker/DEPLOY-RUNBOOK.md) tal como está: DNS → SSH por clave →
firewall y fail2ban → Docker → `.env.production` → `compose up` → crear el usuario dueño →
verificar → cron de backups. La API corre `prisma migrate deploy` sola al arrancar, así que el
schema se crea en el primer encendido.

**La base arranca vacía**, sin datos de demo. El usuario dueño se crea con
`prisma/seed-owner.ts`, que exige `OWNER_EMAIL` y `OWNER_PASSWORD` en el entorno. El mismo
comando sirve para resetear la contraseña.

---

## 5. Convenciones no negociables

**Este es el capítulo importante.** Cada punto está acá porque ya rompió algo.

### 5.0 Entorno de desarrollo (Windows)

**Los procesos de node dejan tomado el motor de Prisma.** Antes de un `prisma generate` o un
`pnpm install`, cerralos:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

Matar la tarea de `pnpm dev` **no** mata a los procesos hijos, así que el bloqueo sobrevive y
`prisma generate` falla con un error de permisos que no dice que el problema es eso.

### 5.1 Migraciones: nunca `prisma migrate dev`

Se cuelga en este proyecto. El procedimiento es generar el SQL a mano:

```bash
cp apps/api/prisma/schema.prisma /tmp/schema-antes.prisma   # 1. ANTES de editar
# 2. editar el schema
cd apps/api
npx prisma migrate diff \
  --from-schema-datamodel /tmp/schema-antes.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/<TIMESTAMP>_<nombre>/migration.sql
npx prisma migrate deploy && npx prisma generate
npx prisma migrate status                                   # 3. SIEMPRE terminar acá
```

⚠️ El timestamp tiene que ser **mayor** que el de la última migración o `migrate deploy` la
ignora sin avisar.

⚠️ **No te saltees `migrate status`.** Saltearlo ya dejó el proyecto sin arrancar una vez: el
código usaba una columna que no existía en la base, con todos los tests en verde.

### 5.2 Dinero

Centavos enteros, siempre. `formatCentsAsArs` / `parseArsToCents` de
[money.ts](packages/shared/src/lib/money.ts). Nunca floats, nunca `toFixed` para calcular.

### 5.3 Permisos: deny-by-default

`RolesGuard` exige rol `OWNER` en **todo** `/admin/*` salvo que el controlador declare `@Roles`
explícitamente. **Al agregar un controlador de administración hay que anotarlo** o queda
accesible sólo para el dueño.

La matriz está fijada en pruebas, en
[roles.e2e-spec.ts](apps/api/test/roles.e2e-spec.ts): **STAFF** opera el día a día (catálogo,
pedidos, lotes, producción); **OWNER** es además el único que toca plata y configuración
(reembolsos, cancelaciones, aprobar transferencias, marcar saldos cobrados, ajustes, tarifas).

Un `Customer` **nunca** puede tocar `/admin/*`: las cuentas de cliente viven en
`sales/customers-auth/`, con su propio guard, separadas del staff.

### 5.4 Validación

Zod en `packages/shared`, consumido por la API y los dos frontends: un solo lugar define cada
contrato.

`ZodValidationPipe` con `@UsePipes()` corre para **todos** los parámetros del método, incluidos
los `@Param`. Por eso filtra por `metadata.type !== 'body'`. **No toques ese guard** o empieza a
validar los path params contra el schema del body.

### 5.5 Prisma

- **`import type { Prisma }` rompe en runtime** si usás `Prisma.DbNull`, `Prisma.JsonNull`,
  `Prisma.join` o `Prisma.sql`: esos necesitan import de valor. Compila igual y falla al
  ejecutar.
- `DbNull` es el NULL de SQL; `JsonNull` es el literal JSON `null`. En un WHERE hay que
  envolverlo: `{ campo: { equals: Prisma.DbNull } }`.

### 5.6 Frontend

- **`@tienda/shared` se consume vía `dist/`**: corré `pnpm --filter @tienda/shared build` antes
  de typecheckear las apps o los errores de tipo no tienen sentido. `@tienda/ui` es fuente TS
  sin build, se ve al instante.
- **Next 16 en dev usa `--webpack`** (está en los scripts). Turbopack rompe las rutas
  dinámicas. No lo quites.
- Las fotos las sirve la API, así que `next/image` necesita `remotePatterns` y
  `dangerouslyAllowLocalIP` en dev: ya está en
  [next.config.ts](apps/storefront/next.config.ts).
- Tema: `@custom-variant dark` + atributo `data-theme` en `<html>` + script anti-FOUC. **No**
  uses la clase `.dark`.
- Un SVG cargado con `<img src>` no hereda `currentColor`. Por eso el logo va inline.
- Estado del navegador (favoritos, por ejemplo): vive fuera de React y se lee con
  `useSyncExternalStore`, no con un `useEffect` que llame a `setState`. Ver
  [favoritos-context.tsx](apps/storefront/src/lib/favoritos-context.tsx): el servidor no tiene
  `localStorage`, así que el primer render tiene que coincidir con el del servidor o hay parpadeo
  y renders en cascada.
- La tienda usa `apiFetchSafe` (si la API falla, la página no se cae) y `resolveImageUrl()`.

### 5.7 Proveedores intercambiables

Patrón ya usado dos veces, y es lo que hace que la plantilla sirva para otro cliente sin tocar
código: una interfaz, varias implementaciones, y una variable de entorno que elige.

- Pagos: [payment-provider.interface.ts](apps/api/src/sales/payments/payment-provider.interface.ts)
  + [payment-provider.registry.ts](apps/api/src/sales/payments/payment-provider.registry.ts),
  elegido con `PAYMENT_PROVIDER`.
- Envíos: [shipping-provider.interface.ts](apps/api/src/shipping/shipping-provider.interface.ts),
  elegido con `SHIPPING_PROVIDER`.

**Los proveedores inactivos quedan registrados a propósito**, para poder seguir procesando los
webhooks de pagos viejos hechos con la otra pasarela. No los saques del registro.

### 5.8 Webhooks de pago — acá se pierde plata

**Nunca confíes en el cuerpo de un webhook.** Verificá la firma si existe, **reconsultá** el
estado al proveedor, y validá monto, moneda, referencia y proveedor contra el `Payment` local.

Ualá Bis **no firma sus webhooks**: la única defensa es la reconsulta. No la debilites.

**Para probar webhooks en desarrollo hace falta un túnel.** Ualá rechaza las URLs de
`localhost`, así que hay que levantar un ngrok (o equivalente) y apuntar `STOREFRONT_URL` y
`API_PUBLIC_URL` a la URL pública. Sin eso el pago se crea pero el webhook nunca llega, y
parece un bug del código cuando no lo es.

El cobro es atómico (`SELECT ... FOR UPDATE`): dos webhooks simultáneos del mismo pago tienen
que producir un solo movimiento y un solo descuento de stock. Está cubierto en
[payments-concurrency.e2e-spec.ts](apps/api/test/payments-concurrency.e2e-spec.ts).

⚠️ **`REJECTED` no es un estado final.** La pasarela deja reintentar sobre el mismo pago y puede
terminar aprobándolo (Ualá hace `PENDING → REJECTED → APPROVED` sobre el mismo uuid). Tratarlo
como final hizo que a un cliente se le cobrara y el pedido quedara cancelado. La transición
`REJECTED → APPROVED` está permitida a propósito en
[order.schema.ts](packages/shared/src/schemas/sales/order.schema.ts). **No la "arregles".**

### 5.9 Operaciones masivas

Todo lo que toca muchos productos de una (edición masiva, subas de precio) sigue el mismo
patrón: **simular primero, aplicar después, y registrar en `audit_logs`**. El panel no deja
aplicar sin haber simulado. Si agregás otra operación masiva, respetá eso.

### 5.10 Al editar opciones de un producto

[`replaceOptions`](apps/api/src/catalog/products/products.service.ts) es el punto más delicado
del catálogo. Las variantes y las fotos están atadas a los valores de opción; si se reemplazan
sin cuidado, las variantes quedan huérfanas y **la tienda cobra el precio de otra variante**.
Eso pasó en producción: un cliente eligió manga corta y pagó la larga.

La lógica de re-vinculación es pura y está testeada en
[variant-generator.spec.ts](apps/api/src/catalog/products/variant-generator.spec.ts)
(`planVariantRelink`). Si tocás ese archivo, los tests son el contrato.

---

## 6. Variables de entorno

El contrato completo, con defaults y validaciones, está en
[env.validation.ts](apps/api/src/config/env.validation.ts). **La API no arranca si falta algo o
si algo está mal**, y eso es a propósito.

En producción (`NODE_ENV=production`) además exige:

- Que `JWT_ACCESS_SECRET` y `COOKIE_SECRET` no sean secretos de desarrollo (rechaza cualquier
  cosa que contenga `dev-`, `change-me` o `changeme`).
- Que `ADMIN_URL`, `STOREFRONT_URL` y `API_PUBLIC_URL` sean HTTPS.
- Que la pasarela elegida tenga credenciales completas, y Ualá además `UALA_ENV=production`.

Las imprescindibles: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` (≥16), `COOKIE_SECRET`
(≥16), `ADMIN_URL`, `STOREFRONT_URL`, `API_PUBLIC_URL`. El resto tiene default razonable.

Opcionales que apagan una función sin romper nada si faltan: `ANTHROPIC_API_KEY` (análisis del
estampado con IA), `META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN`, `VAPID_*` (push al dueño),
credenciales de Andreani y de Correo Argentino.

⚠️ **Turnstile viene con las claves de prueba de Cloudflare, que aprueban todo.** Mirá
[turnstile.service.ts](apps/api/src/common/turnstile/turnstile.service.ts): si no está
configurado, el captcha **devuelve `true` siempre**. Hasta poner las claves reales, el checkout
y el login no tienen protección contra bots. Es un paso obligatorio antes de entregar.

⚠️ Si la API key de Anthropic está ligada a un espacio de trabajo, hay que setear también
`ANTHROPIC_WORKSPACE_ID` (va en un header; el ID no es secreto).

---

## 7. Verificación antes de entregar

```bash
pnpm --filter @tienda/shared build   # si tocaste shared
npx prisma migrate status            # si tocaste el schema — desde apps/api
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build
```

**Que los tests pasen no alcanza.** Levantá con `pnpm dev` y confirmá que responden las tres:
API 3001, tienda 3000, panel 3002. Ya pasó una vez que todo estaba verde y la app no arrancaba.

**Antes de anunciar**, recorrido completo en un celular real, en tema claro y en oscuro:

> home → liga → producto → personalizar → carrito → checkout con seña → confirmación →
> marcar lote recibido → correo del saldo → pagar el saldo → despacho con seguimiento

Y una compra real de monto bajo en producción, en cada modalidad. El cobro es lo único que no se
puede dar por bueno sin probarlo con plata de verdad.

### Verificar un deploy desde afuera

Después de un deploy, chequear que los servicios responden no alcanza: hay que confirmar que
están corriendo **el código nuevo**.

⚠️ **Buscar un texto en el HTML que devuelve la página no sirve para saber si una pantalla se
desplegó.** Next manda el payload de RSC en el HTML y textos como "no encontrada" aparecen en
todas las páginas. Dos formas que sí funcionan: comparar contra una ruta que seguro no existe,
o bajar los chunks de JS que la página referencia y buscar el texto ahí. Un componente de
cliente no muestra sus textos en el HTML del servidor: están en el chunk.

Para un endpoint nuevo de la API, un **401** sin credenciales es buena señal (existe y pide
login); un **404** significa que no se desplegó. Comprobalo contra un endpoint inventado para
asegurarte de que el 401 es real y no un catch-all.

---

## 8. Decisiones ya tomadas

Están acá para que no se reviertan por parecer raras.

| Decisión | Por qué |
|---|---|
| `REJECTED → APPROVED` es una transición válida | La pasarela reintenta sobre el mismo pago. Ver 5.8 |
| Las pasarelas inactivas siguen registradas | Para procesar webhooks de pagos viejos |
| Los proveedores de envío que no se usan no se borran | Cambiar de proveedor es una variable de entorno |
| El entrypoint de la API es `dist/main.js`, sin anidar en `dist/src/` | `tsconfig.build.json` ya está corregido. No lo revierta |
| Los favoritos viven en el navegador, no en la cuenta | La mayoría compra sin registrarse; pedir cuenta para guardar un favorito es la fricción que esto evita |
| Las plantillas de correo viven en la base; si no hay fila, se usa el default del código | Así "restaurar" es borrar la fila, sin migración |
| La personalización tiene un precio único | Requisito del negocio. Ver 2 |
| Los cupones `PERCENTAGE` están limitados a 1–100 por schema | Sin eso, un cupón de 150% daba totales negativos |
| El seed de producción no carga datos de demo | Una tienda nueva arranca vacía, no con productos de prueba |
| Nginx + certbot en el host, no Caddy en un contenedor | Nginx ya es dueño de los puertos 80/443 en el VPS |

---

## 9. Herramientas de mantenimiento

Scripts operativos de la API. Cada uno documenta su uso en el encabezado y **todos son dry-run
por defecto**: escriben sólo con `--apply`.

| Script | Para qué |
|---|---|
| [ai-name-products.ts](apps/api/src/scripts/ai-name-products.ts) | Nombra y describe productos con la Batch API de Anthropic (50% más barata) |
| [ai-style-products.ts](apps/api/src/scripts/ai-style-products.ts) | Completa color y tipografía del estampado con IA |
| [free-personalization-batch.ts](apps/api/src/scripts/free-personalization-batch.ts) | Lo mismo sin costo: elige contraste con Sharp y fuentes ya cargadas |

Se corren dentro del contenedor: `node dist/scripts/<nombre>.js --limit 8` para probar, y
`--apply` para escribir.

Backups: [ops/README.md](ops/README.md). `pg_dump -Fc` diario por cron, más las imágenes de
`uploads/`. **Un backup sin restauración probada no es un backup**: hay un `restore-db.sh` y
conviene probarlo en una base limpia al menos una vez.

---

## 10. Estado y deuda conocida

Lo que falta, para no prometer lo que no está:

- **Turnstile está desactivado** mientras no haya claves reales (ver capítulo 6). Es lo más
  urgente de cualquier instalación nueva.
- **El envío se cobra únicamente en la etapa del saldo.** `Order.shippingCents` lo escribe sólo
  [balance.service.ts](apps/api/src/import/balance.service.ts); el checkout guarda la dirección
  pero no cobra envío. Para un pedido de stock inmediato eso significa que **el envío no se cobra
  en ningún momento**, y que un cupón de envío gratis no descuenta nada ahí porque no hay nada
  que descontar. En el flujo por encargo sí se honra (`balance.service.ts:116`). Si el cliente
  nuevo vende sólo stock inmediato y quiere cobrar envío, **esto hay que implementarlo**.
- La cotización por API de **Andreani** y **Correo Argentino** está implementada pero no probada
  con credenciales reales. El modo manual sí funciona en producción.
- **Observabilidad**: no hay Sentry ni logs estructurados con request id. `/health` verifica
  Postgres e informa el estado del correo, pero **no mira Redis** — y BullMQ depende de Redis,
  así que la API puede responder `ok` con las colas caídas.
- Los correos y el push se loguean si fallan, pero **no se reintentan**: falta un outbox con
  backoff.
- El analizador de estampado con IA es **opcional** y depende de una API key de pago.
- No hay E2E de navegador: los E2E son de la API.

### Si vas a subir esto a producción para alguien

- Rotá **todos** los secretos antes de entregar, y no los dejes en el historial de ninguna
  conversación ni en una captura.
- No dejes `OWNER_PASSWORD` en el `.env.production` después de crear la cuenta.
- Verificá el dominio del SMTP (SPF, DKIM, DMARC) **antes** de la primera venta, o los correos
  de confirmación van a spam.
- Si el proveedor de correo tiene lista de IPs autorizadas, agregá la IP del servidor **antes**
  de activar el bloqueo.

---

## 11. Herramienta local de carga del catálogo (no versionada)

En la máquina de desarrollo puede haber un `productos.py` con su `readme1.md`: maneja un
navegador real con Playwright contra el panel para dar de alta productos masivamente desde una
carpeta de fotos del proveedor. **No es parte de la aplicación, no se despliega y está en
`.gitignore`** — igual que `importador/` y el perfil de navegador.

⚠️ Si trabajás con eso: el perfil de Playwright guarda **contraseñas y cookies de sesión**.
Nunca lo versiones. En este repo estuvo versionado por error y hay que purgarlo del historial.
