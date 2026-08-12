#!/usr/bin/env bash
# Backup diario: dump de la base + archivo de las fotos subidas.
# Uso (desde la carpeta docker/):  ./backup.sh
# Programar con cron:  0 3 * * *  /ruta/al/repo/docker/backup.sh >> /var/log/tienda-backup.log 2>&1
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="${BACKUP_DIR:-$DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$DEST"

# Credenciales desde el mismo .env.production
set -a; source "$DIR/.env.production"; set +a

echo "[$(date)] Dump de la base…"
docker compose -f "$DIR/docker-compose.prod.yml" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DEST/db_$STAMP.sql.gz"

echo "[$(date)] Archivo de las fotos…"
docker run --rm -v tienda-online-prod_uploads_data:/data:ro -v "$DEST":/backup alpine \
  tar czf "/backup/uploads_$STAMP.tar.gz" -C /data .

echo "[$(date)] Limpiando backups de más de $RETENTION_DAYS días…"
find "$DEST" -name '*.gz' -mtime +"$RETENTION_DAYS" -delete

echo "[$(date)] Listo. Guardado en $DEST"
echo "⚠️  Recordá probar la restauración en una base limpia: un backup sin restaurar no es un backup."
