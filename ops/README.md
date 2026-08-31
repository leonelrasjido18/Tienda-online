# Operaciones — Remeras del Área

Scripts que corren en el VPS (`/opt/tienda/ops/`).

## Backups

`backup.sh` hace, cada día por cron (03:30):

- **Base de datos**: `pg_dump -Fc` → `/opt/tienda/backups/db/db_<fecha>.dump` (se conservan 14).
- **Imágenes**: `tar.gz` del volumen de uploads → `/opt/tienda/backups/uploads/uploads_<fecha>.tar.gz` (se conservan 7).
- Log en `/opt/tienda/backups/backup.log`.

Los backups son **locales** al VPS y con permisos `700/600` (solo root). Para
protegerse de una caída total del VPS conviene sumar copia **fuera del servidor**
(Backblaze B2 / S3) — pendiente.

### Correr un backup a mano
```sh
/opt/tienda/ops/backup.sh
```

### Restaurar (probar el backup)
```sh
# A una base de prueba (NO toca producción):
/opt/tienda/ops/restore-db.sh /opt/tienda/backups/db/db_XXXX.dump

# Sobre la base de producción (la recrea desde cero): pasar el nombre real:
/opt/tienda/ops/restore-db.sh /opt/tienda/backups/db/db_XXXX.dump <POSTGRES_DB>
```

### Restaurar imágenes
```sh
tar xzf /opt/tienda/backups/uploads/uploads_XXXX.tar.gz \
  -C /var/lib/docker/volumes/tienda-online-prod_uploads_data/_data
```
