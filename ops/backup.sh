#!/bin/sh
# Backup diario de Remeras del Área: dump de la base + tar de las imágenes.
# Pensado para correr por cron como root en el VPS. Instalado en /opt/tienda/ops/.
set -eu

# Fuera de /opt/tienda a propósito: esa carpeta es el contexto de build de Docker
# y los backups se copiarían en cada build (llenaron el disco una vez).
BACKUP_DIR=/var/backups/tienda
DB_DIR="$BACKUP_DIR/db"
UP_DIR="$BACKUP_DIR/uploads"
LOG="$BACKUP_DIR/backup.log"
PG_CONTAINER=tienda-online-prod-postgres-1
UPLOADS_PATH=/var/lib/docker/volumes/tienda-online-prod_uploads_data/_data

# Cuántas copias conservar.
KEEP_DB=14
# Cada copia de imágenes pesa cientos de MB y cambian poco: con 3 alcanza.
KEEP_UPLOADS=3

STAMP=$(date +%Y%m%d_%H%M)
mkdir -p "$DB_DIR" "$UP_DIR"
chmod 700 "$BACKUP_DIR"

log() { echo "$(date '+%F %T') $*" | tee -a "$LOG"; }

log "== inicio backup =="

# --- Base de datos (formato custom de Postgres, ya comprimido) ---
if docker exec "$PG_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DB_DIR/db_$STAMP.dump" 2>>"$LOG"; then
  log "DB ok: db_$STAMP.dump ($(du -h "$DB_DIR/db_$STAMP.dump" | cut -f1))"
else
  log "DB ERROR: el dump falló, se descarta el archivo parcial"
  rm -f "$DB_DIR/db_$STAMP.dump"
fi

# --- Imágenes subidas (uploads) ---
if tar czf "$UP_DIR/uploads_$STAMP.tar.gz" -C "$UPLOADS_PATH" . 2>>"$LOG"; then
  log "uploads ok: uploads_$STAMP.tar.gz ($(du -h "$UP_DIR/uploads_$STAMP.tar.gz" | cut -f1))"
else
  log "uploads ERROR: el tar falló, se descarta el archivo parcial"
  rm -f "$UP_DIR/uploads_$STAMP.tar.gz"
fi

# --- Rotación: conservar solo las últimas N copias ---
ls -1t "$DB_DIR"/db_*.dump 2>/dev/null | tail -n +$((KEEP_DB + 1)) | xargs -r rm -f
ls -1t "$UP_DIR"/uploads_*.tar.gz 2>/dev/null | tail -n +$((KEEP_UPLOADS + 1)) | xargs -r rm -f

chmod 600 "$DB_DIR"/*.dump "$UP_DIR"/*.tar.gz 2>/dev/null || true
log "== fin backup =="
