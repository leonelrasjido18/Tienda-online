# Runbook de deploy — VPS (synory.dev)

Pasos para poner la tienda en producción en el VPS de Hostinger
(`187.77.234.239`, Ubuntu 24.04). Se ejecuta una vez; las actualizaciones son el paso 8.

---

## 1. DNS (en el panel de Hostinger → Administrador de DNS de `synory.dev`)

Crear registros **A** apuntando todos al VPS:

| Tipo | Nombre  | Valor            |
|------|---------|------------------|
| A    | `@`     | `187.77.234.239` |
| A    | `www`   | `187.77.234.239` |
| A    | `api`   | `187.77.234.239` |
| A    | `admin` | `187.77.234.239` |

> Esperar a que propague (`nslookup api.synory.dev`) antes del paso 6, o Caddy no
> podrá emitir los certificados.

## 2. Acceso seguro por SSH (clave, no contraseña)

En **tu máquina** (no en el chat), generá el par de claves y copiá la pública al VPS:

```bash
ssh-keygen -t ed25519 -C "deploy-synory"
ssh-copy-id root@187.77.234.239        # o pegá la .pub en Hostinger → Clave SSH
```

## 3. Endurecer el servidor

```bash
ssh root@187.77.234.239
# Firewall: sólo SSH + web
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
# (Recomendado) deshabilitar login por contraseña una vez que la clave funcione:
#   sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart ssh
apt update && apt install -y fail2ban
```

## 4. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

## 5. Traer el código y configurar el entorno

```bash
git clone <URL_DEL_REPO> /opt/tienda && cd /opt/tienda/docker
cp .env.production.example .env.production
# Generar secretos:
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)"
echo "COOKIE_SECRET=$(openssl rand -base64 48)"
npx web-push generate-vapid-keys      # para VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
nano .env.production                    # completar TODO (ver docs/DEPLOY-VPS.md)
```

## 6. Levantar todo

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

- La API corre `prisma migrate deploy` sola al arrancar (crea el schema).
- Caddy emite los certificados HTTPS automáticamente al primer acceso.

## 7. Crear el usuario OWNER del panel

La base arranca vacía (sin datos demo). Definí `OWNER_EMAIL` y `OWNER_PASSWORD` en
`.env.production` y creá la cuenta de dueña del panel:

```bash
docker compose -f docker-compose.prod.yml exec api pnpm exec tsx prisma/seed-owner.ts
```

Después podés borrar `OWNER_PASSWORD` del archivo. Para resetear la clave, volvés a
correr el mismo comando con una nueva.

## 8. Verificar

- https://synory.dev (tienda) · https://admin.synory.dev (panel) · https://api.synory.dev/health → `200`
- Candado HTTPS válido en los tres.

## 9. Backups automáticos

```bash
crontab -e
# Backup diario 3am:
0 3 * * * /opt/tienda/docker/backup.sh >> /var/log/tienda-backup.log 2>&1
```

Y **probar la restauración** en una base limpia al menos una vez.

---

## Actualizar (deploys siguientes)

```bash
cd /opt/tienda && git pull
cd docker && docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```
