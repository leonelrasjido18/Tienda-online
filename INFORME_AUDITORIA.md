# Informe de auditoría técnica — Tienda online

Fecha: 10 de agosto de 2026. Alcance: monorepo completo (`apps/api`, `apps/admin`, `apps/storefront` y `packages/*`), revisión estática y ejecución de las verificaciones disponibles. No se hicieron cambios funcionales.

## Resumen ejecutivo

La base técnica está bien encaminada: TypeScript estricto, validación Zod en buena parte de las entradas, Prisma, rotación de refresh tokens, CORS con orígenes explícitos, transacciones para checkout y verificación remota de los pagos. Sin embargo, hay problemas importantes antes de operar a escala o con más de un usuario interno.

Prioridades máximas:

1. El modelo de roles no está aplicado: cualquier usuario autenticado puede ejecutar toda la API de administración.
2. El detalle completo de un pedido es público por UUID, por lo que un enlace filtrado expone datos personales, dirección, pagos y eventos.
3. El cobro puede procesarse dos veces ante webhooks concurrentes y descontar stock doblemente.
4. Si falla la creación del checkout en la pasarela, queda una orden/reserva creada y el carrito se borra, sin recuperación para el cliente.
5. Las dependencias de producción tienen 8 vulnerabilidades altas, incluidas las bibliotecas que procesan uploads.

## Hallazgos

| Severidad | Hallazgo | Evidencia | Riesgo / recomendación |
|---|---|---|---|
| Crítica | RBAC inactivo | `RolesGuard` existe, pero no hay ningún `@Roles(...)` en `apps/api/src`; todos los controladores `/admin/*` solo requieren un JWT válido. | Un empleado de menor privilegio puede modificar catálogo, precios, pedidos, reembolsos, lotes y suscripciones. Definir matriz de permisos y anotar cada controlador/acción; agregar pruebas 403 por rol. |
| Alta | Pedido público con información sensible | `GET /orders/:id` es `@Public()` y llama a `OrdersService.detail`, que devuelve email, teléfono, dirección, notas, pagos, eventos y seguimiento. | Un UUID conocido, compartido en URL o registrado en logs concede acceso total. Reemplazarlo por un token de consulta aleatorio, independiente y con vencimiento, o autenticar/confirmar identidad del cliente. Separar DTO público de DTO administrativo. |
| Alta | Doble cobro lógico / doble descuento de stock | `applyPaymentStatus` comprueba que el pago no esté aprobado fuera de la transacción; después `applyApprovedPayment` actualiza sin condición y consume stock. | Dos webhooks válidos concurrentes de la misma operación pueden ver `PENDING` y ambos descontar. Bloquear la fila de pago/orden (`FOR UPDATE`) y hacer transición atómica `PENDING -> APPROVED`; solo el proceso que actualice una fila puede consumir stock. Probar concurrencia. |
| Alta | Checkout no recuperable si la pasarela falla | `CheckoutService.createOrder` confirma orden, reserva stock y borra carrito antes de `provider.createCheckout`. | Una caída o timeout de Mercado Pago/Ualá devuelve error al cliente, pero deja pedido pendiente y reserva tomada. Crear el pago/preferencia antes de vaciar el carrito o conservar el carrito y ofrecer reintento idempotente de pago para la orden pendiente. Usar una clave de idempotencia del cliente. |
| Alta | Dependencias vulnerables en producción | `pnpm audit --prod`: 8 altas, 13 moderadas y 2 bajas. Destacan `multer@2.0.2` (DoS), `sharp@0.33.5`/libvips (procesa uploads) y `nodemailer@6.10.1` (varias). | Actualizar y bloquear versiones: Multer >= 2.1.1, Sharp >= 0.35.0 y Nodemailer >= 7.0.11 (validar migración); actualizar Nest/Express y transitorios. Repetir audit y pruebas. |
| Alta | Sin limitación de tasa ni protección antiabuso | No hay rate limiter en `main.ts`. Endpoints públicos costosos: `/auth/login`, `/checkout`, `/catalog/.../customize/render`, saldo y webhooks. | Fuerza bruta, creación masiva de pedidos, consumo de CPU/memoria por render y presión sobre pasarelas. Añadir throttling por IP/identidad, límites específicos y CAPTCHA progresivo para login/checkout. Poner WAF/reverse proxy delante. |
| Alta | Configuración de producción permite secretos de desarrollo | `env.validation.ts` solo exige longitud; valores `dev-...` y credenciales vacías son válidos incluso con `NODE_ENV=production`. | Despliegue inseguro por error humano. Añadir refinamientos de producción: secretos no conocidos, URL HTTPS pública, claves de pasarela/VAPID obligatorias según función y SMTP TLS. Usar un gestor de secretos. |
| Media | Webhook no valida monto, moneda ni correlación completa | Mercado Pago/Ualá reconsultan el pago, pero no se comprueba que el importe, moneda, proveedor y preferencia coincidan con el `Payment` local. | Un pago con `external_reference` inesperada o monto distinto puede marcar una orden incorrectamente. Persistir `providerRef` en campo indexado y verificar importe en centavos, ARS, estado y referencia antes de aprobar. |
| Media | Transiciones de pagos y reservas no son una máquina de estados | Un webhook tardío no aprobado puede actualizar un pago ya `APPROVED`; expiración y aprobación no bloquean explícitamente la orden entre sí. | Inconsistencias (`Payment=REJECTED` y `Order=PAID`) o reservas liberadas mientras se confirma pago. Definir transiciones permitidas y aplicar bloqueo de orden/pago en todas las operaciones de cambio. |
| Media | Entradas administrativas sin validación | `AdminOrdersController` usa cuerpos inline para cancelación, reembolso y envíos; `OrdersService` recibe `any` para envío/estado. | Estados arbitrarios, montos inválidos, URLs no confiables y datos operativos corruptos. Crear schemas Zod para cada comando, enumerar estados y limitar longitudes/formato. |
| Media | Validación de uploads incompleta | Imágenes se aceptan por `mimetype` declarado; fuentes solo por extensión. Los archivos se guardan públicamente y `sharp`/Satori los procesan. | Suplantación de tipo, archivos maliciosos/corruptos y DoS; impacto mayor por Sharp vulnerable. Detectar firma real, limitar píxeles/frames/tiempo, validar fuentes con parser aislado y responder con cabeceras seguras para `/uploads`. |
| Media | HTML de correo interpolado sin escape | `MailService` inserta `contactName`, email y otros valores en HTML. | Un nombre con HTML puede alterar el contenido que reciben cliente y tienda. Escapar todas las interpolaciones HTML y validar/normalizar campos de contacto. |
| Media | Precios, publicación y personalización no se revalidan por completo al pagar | Carrito conserva `priceCentsAtAdd`; checkout no comprueba estado activo del producto/variante ni valida que la personalización siga habilitada y autorizada por la plantilla. | Compra de precio antiguo, producto archivado y opciones no permitidas tras cambios del catálogo. Recalcular desde datos actuales o definir expiración/versionado explícito del precio; validar producto activo y plantilla al confirmar. |
| Media | Exposición de servicios locales y credenciales débiles en Compose | `docker-compose.yml` publica PostgreSQL y Redis en el host y usa credenciales conocidas. | Si se reutiliza fuera de desarrollo, expone la base y cola. Mantenerlo solo para dev, no publicar puertos en producción y usar redes privadas, secretos, TLS y volúmenes/backups administrados. |
| Media | Falta de cabeceras y endurecimiento HTTP | `main.ts` no configura Helmet/CSP/HSTS ni límites globales de body; tampoco `trust proxy` explícito. | Menor defensa frente a XSS, clickjacking y despliegues tras proxy con IP incorrecta. Añadir Helmet con CSP revisada, tamaño de payload explícito, HTTPS/HSTS en producción y proxy confiable configurado. |
| Media | Observabilidad y resiliencia de integraciones insuficientes | Correos fallan y solo se registran; llamadas externas tienen timeout pero no reintentos controlados, outbox ni alertas. | Pedidos aceptados sin notificación, operaciones difíciles de recuperar o auditar. Adoptar outbox/colas para emails y notificaciones, reintentos con backoff, trazas, métricas y alertas. |
| Baja | Calidad de código bloqueada por lint | `pnpm lint` falla: 15 errores y 1 warning, principalmente `any` en órdenes, envíos y procesamiento de lotes. | Menor garantía de mantenimiento y CI roto. Sustituir `any` por tipos Prisma/DTO, resolver bloque vacío y habilitar lint obligatorio en CI. |
| Baja | Cobertura de pruebas insuficiente para el riesgo del negocio | Solo 54 pruebas unitarias y 7 E2E; no hay pruebas de UI y las E2E no cubren checkout, webhooks, stock, permisos ni reembolsos. | Regresiones en dinero, inventario y permisos. Priorizar la matriz de pruebas detallada abajo. |

## Resultado de verificaciones

- `pnpm typecheck`: correcto.
- `pnpm test`: correcto, 54 pruebas.
- `pnpm test:e2e`: correcto, 7 pruebas; los builds de API y ambos frontends también completaron.
- `pnpm lint`: falla con 15 errores y 1 advertencia en la API.
- `pnpm audit --prod`: 0 críticas, 8 altas, 13 moderadas y 2 bajas.

Que las pruebas actuales pasen no invalida los hallazgos: no ejercitan las carreras concurrentes, autorización por rol ni los casos de fallo de proveedores.

## Plan de implementación

### Fase 0 — Contención (antes de producción o en 1–2 días)

1. Actualizar dependencias vulnerables y volver a ejecutar audit, lint, tipos y pruebas.
2. Aplicar `@Roles` a todos los endpoints administrativos; decidir al menos `OWNER`, `MANAGER` y `OPERATOR` con principio de mínimo privilegio.
3. Despublicar el detalle de pedido por ID. Migrar a un token de visualización hash/rotativo o a verificación adicional del email.
4. Añadir límite de tasa a login, checkout, render y balance; fijar un tamaño máximo de request.
5. Corregir los errores de lint y activar CI que bloquee merge si falla audit/lint/test/typecheck.

### Fase 1 — Integridad de dinero e inventario (3–5 días)

1. Implementar máquina de estados para `Payment`, `Order` y `PaymentLink`.
2. En la aprobación: bloquear pago y orden, usar actualización condicional y consumir/liberar stock una única vez.
3. Añadir idempotencia de checkout y un endpoint/flujo de “reintentar pago” para una orden pendiente válida.
4. Verificar en webhook importe, moneda, referencia, proveedor y preferencia local; registrar rechazo explicable sin modificar la orden.
5. Validar todos los DTO administrativos mediante schemas compartidos.

### Fase 2 — Seguridad de contenido y despliegue (3–5 días)

1. Verificar bytes reales de imagen/fuente, limitar resolución y aislar procesamiento costoso; borrar archivos huérfanos de manera programada.
2. Escapar plantillas HTML de correo y añadir pruebas de inyección.
3. Aplicar Helmet/CSP, HTTPS/HSTS y configurar proxy confiable según infraestructura.
4. Endurecer validación de ambiente productivo y migrar secretos a vault/variables del proveedor.
5. Separar el Compose de desarrollo del manifiesto de producción; DB/Redis no deben exponerse públicamente.

### Fase 3 — Confiabilidad y calidad continua (1–2 semanas)

1. Implementar outbox + workers para correo, push y efectos posteriores al commit; reintentos exponenciales y alertas.
2. Añadir logs estructurados con ID de request/orden, métricas (errores, cola, pagos, stock negativo) y health checks de dependencias.
3. Agregar CI con migración efímera, pruebas E2E y análisis de dependencias periódico.
4. Revisar política de precios: recalcular al checkout o mostrar fecha de vencimiento del precio del carrito; impedir compra de productos no activos.

## Pruebas que deben agregarse primero

1. Un `OPERATOR` no puede reembolsar, editar precios ni ejecutar lotes; un `OWNER` sí.
2. Un pedido no puede consultarse con su UUID sin token/identidad; el DTO público nunca contiene dirección, email completo ni pagos.
3. Dos webhooks simultáneos para el mismo pago producen un único movimiento `SALE` y un único decremento de inventario.
4. Aprobación y expiración simultáneas terminan en un único estado coherente y stock no negativo.
5. Error/timeout al crear checkout conserva carrito y permite reintento idempotente.
6. Webhook con monto, moneda, referencia o proveedor distintos se rechaza sin tocar orden ni pago.
7. Archivos falsos, corruptos, sobredimensionados o de fuente inválida se rechazan sin bloquear el proceso.
8. Payload con HTML en nombre/contacto llega escapado al correo.
9. Flujos E2E de carrito → checkout → webhook → despacho y seña → saldo → pago final.

## Criterio de salida

Considerar lista la aplicación para producción cuando no queden vulnerabilidades altas conocidas, todos los endpoints administrativos tengan permisos probados, el acceso público a pedidos esté tokenizado, los pagos sean idempotentes bajo concurrencia y el pipeline obligatorio esté en verde.
