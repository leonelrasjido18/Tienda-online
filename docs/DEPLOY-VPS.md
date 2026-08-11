# Checklist para el deploy en el VPS

Lista de **todo lo que tenés que conseguir/pasarme** para poner la tienda online en
producción. Está dividido en lo **obligatorio para arrancar** y lo **opcional/mejora**.

Convención:
- 🔴 **Obligatorio** — sin esto no se puede salir a vender.
- 🟡 **Opcional** — la tienda funciona sin esto (hay un modo alternativo), se puede sumar después.
- 🤖 **Lo genero/configuro yo** — no tenés que conseguirlo, es info para que sepas que está cubierto.

---

## 1. Servidor y dominio 🔴

- [ ] **VPS** con acceso SSH: IP pública, usuario con sudo, y forma de entrar (clave SSH o contraseña).
      Recomendado: **Ubuntu 22.04/24.04, 2 vCPU, 4 GB RAM, 40 GB+ SSD**.
- [ ] **Dominio** (ej. `remerasdelarea.com.ar`) + acceso al panel DNS del registrador
      (NIC.ar u otro) para apuntar los registros.
- [ ] **Decisión de estructura** (ya charlada: un dominio, panel aparte). A confirmar los nombres:
  - Tienda → `www.tudominio` (o raíz)
  - API → `api.tudominio`
  - Panel → `admin.tudominio` (o una ruta protegida)

## 2. Base de datos y Redis 🤖

- Se instalan **dentro del VPS** (PostgreSQL 16 + Redis). No dependen de nadie externo.
- Las credenciales las **genero yo**. No tenés que conseguir nada, salvo que prefieras
  una base administrada (Neon, RDS, etc.) — avisame si es el caso.

## 3. Secretos internos de la app 🤖

- `JWT_ACCESS_SECRET`, `COOKIE_SECRET`, claves **VAPID** (notificaciones push) → los **genero yo**.

## 4. Pasarela de pago 🔴

Elegí **una** (se puede cambiar después):

- [ ] **Ualá Bis (producción)**: `UALA_USERNAME`, `UALA_CLIENT_ID`, `UALA_CLIENT_SECRET`.
      ⚠️ **Regenerá las credenciales que se expusieron en una captura** antes de usarlas.
- [ ] **o Mercado Pago (producción)**: `MP_ACCESS_TOKEN` + `MP_WEBHOOK_SECRET`.

## 5. Envío de correos (SMTP) 🔴

Para los mails de pedidos y de cobro de saldo. Conseguí una cuenta de un proveedor de
correo transaccional (Brevo, Resend, SendGrid, Zoho…):

- [ ] `SMTP_HOST`, `SMTP_PORT`, usuario y contraseña SMTP.
- [ ] Dirección **remitente** (`SMTP_FROM`), idealmente con tu dominio (ej. `no-reply@tudominio`).
- [ ] Acceso DNS para configurar **SPF / DKIM / DMARC** (para que los mails no caigan en spam).

## 6. Datos de la tienda y legales 🔴

- [ ] **Datos fiscales del vendedor** (razón social / CUIT, domicilio) para remitos.
- [ ] **CBU/alias** para transferencias, **WhatsApp**, **Instagram**, **email de contacto**,
      **dirección de retiro** y **horarios**.
- [ ] **Revisar y aprobar los textos legales** (hoy están como BORRADOR): términos y
      condiciones, cambios/devoluciones, privacidad, botón de arrepentimiento/defensa del
      consumidor. Importante por la venta con seña.
- [ ] **Logo / identidad** final, si querés ajustar algo de la marca.

## 7. Analizador con IA 🟡

- [ ] `ANTHROPIC_API_KEY` (para el botón "Analizar con IA"). Confirmar el `ANTHROPIC_MODEL` vigente.

## 8. Cotización de envíos automática 🟡

- [ ] **Andreani**: `ANDREANI_USER`, `ANDREANI_PASSWORD`, `ANDREANI_CLIENTE`, `ANDREANI_CONTRATO`.
      Sin esto queda el **modo manual** con tarifas por provincia (ya funciona).

## 9. Anti-bot (CAPTCHA) 🟡

- [ ] **Cloudflare Turnstile**: `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` reales.
      Sin esto queda deshabilitado (no molesta, pero no protege login/checkout).

---

## Lo que yo dejo hecho del lado técnico (Fase 8) 🤖

Para que sepas el alcance, esto lo construyo/configuro yo una vez que tenga lo de arriba:

- Dockerfiles + `docker-compose` de producción.
- **Nginx + HTTPS** (Certbot) para los tres dominios.
- **Backups** diarios de la base + imágenes, con restauración probada.
- Endurecimiento de seguridad (sin secretos de dev, HTTPS forzado, no exponer Postgres/Redis).
- **CDN de imágenes** para que la tienda vuele con catálogo grande.
- Observabilidad básica (logs, health checks) y deploy por SSH.

> **Para ejecutar el deploy** necesito **acceso SSH al VPS** (o que corras vos los comandos
> que te prepare). Definimos eso cuando tengas el servidor.

---

## Mínimo indispensable para el primer deploy

Si querés arrancar con lo justo y sumar el resto después, lo imprescindible es:
**VPS + dominio (1) · una pasarela de pago (4) · SMTP (5) · datos y legales (6).**
Con eso ya se puede vender; el resto es mejora.
