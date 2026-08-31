#!/bin/sh
# Restaura un dump de la base en una base de datos DESTINO.
# Uso:
#   ops/restore-db.sh <archivo.dump> [nombre_db_destino]
#
# Por seguridad, si no se pasa destino, restaura en "restore_test" (una base
# de prueba), NUNCA sobre la base de producción. Para restaurar sobre la base
# real, pasá explícitamente el nombre de la base de producción como 2º argumento
# (se recrea desde cero: se borra y se vuelve a crear).
set -eu

PG_CONTAINER=tienda-online-prod-postgres-1
DUMP="${1:?Falta el archivo .dump}"
TARGET="${2:-restore_test}"

if [ ! -f "$DUMP" ]; then
  echo "No existe el archivo: $DUMP" >&2
  exit 1
fi

echo ">> Restaurando '$DUMP' en la base '$TARGET'…"
docker exec "$PG_CONTAINER" sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists \"$TARGET\""
docker exec "$PG_CONTAINER" sh -c "createdb -U \"\$POSTGRES_USER\" \"$TARGET\""
docker exec -i "$PG_CONTAINER" sh -c "pg_restore -U \"\$POSTGRES_USER\" -d \"$TARGET\" --no-owner" < "$DUMP"

echo ">> Verificación (cantidad de productos):"
docker exec "$PG_CONTAINER" sh -c "psql -U \"\$POSTGRES_USER\" -d \"$TARGET\" -tAc 'SELECT count(*) FROM products;'"
echo ">> Listo. Base restaurada en '$TARGET'."
