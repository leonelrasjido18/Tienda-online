# Carga automática de productos en remerasdelarea.com

## Qué hace
Recorre `D:\Fotos camisetas\<categoría>\<producto>\`, y por cada carpeta
de producto: saca el nombre (la parte en español, antes del corchete),
agrupa las fotos en frente/espalda/logo/detalle según su posición, y
completa el formulario de `admin.remerasdelarea.com` para crear el
producto — todo manejando un navegador real con Playwright, como si vos
lo estuvieras haciendo a mano.

Es resumible: si se corta a mitad de camino, la próxima corrida sigue
donde quedó (`_carga_state.json` en la misma carpeta de fotos).

## 1. Instalación
```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

## 2. Completar los selectores reales (el paso importante)
El script tiene puntos marcados con `TODO` en `cargar_producto()` — ahí
usé nombres de campo inventados porque no puedo ver tu panel de admin.
La forma más rápida de conseguir los reales:

```
playwright codegen https://admin.remerasdelarea.com
```

Esto abre un Chrome controlado + una ventana aparte que graba cada clic
como código Playwright. Iniciá sesión, andá a "nuevo producto", y cargá
**un producto de prueba a mano**, completando nombre, subiendo una foto
de cada tipo y tildando talles. La ventana de grabación te va a mostrar
línea por línea el código con los selectores reales — copiá esas líneas
y reemplazá los `TODO` correspondientes en `cargar_producto()`.

## 3. Ajustar el orden de las fotos
En el bloque `PHOTO_ROLES`, confirmá con 2-3 álbumes reales qué posición
es cada cosa (por ahora asume 0=frente, 1=espalda, 2=logo, el resto
detalle). Si el proveedor no es 100% consistente entre productos, avisame
y pensamos una validación extra antes de publicar.

## 4. Probar antes de la corrida completa
Dejá `LIMIT = 3` (arriba del todo, en CONFIG) las primeras veces, para
ver 2-3 productos cargarse bien antes de soltarlo con los 5000. Si el
panel tiene opción de "guardar como borrador", usala para las pruebas
en vez de publicar en la tienda en vivo.

## 5. Login
La primera vez que corras el script se abre el navegador y el programa
espera a que inicies sesión manualmente (te lo pide por consola). Una
vez logueado, esa sesión queda guardada en `playwright_profile/` y las
corridas siguientes no vuelven a pedir login.

## Si algo falla
Cada error queda logueado en `_carga_log.txt`, y además se guarda una
captura de pantalla en `_errores/<producto>.png` del estado exacto en
que falló — mandámela si no entendés qué pasó y lo revisamos.

## Nota
Esto crea productos reales en tu tienda en vivo. Con 5000 productos, un
selector mal puesto se repite 5000 veces antes de que lo notes si no
probás primero con `LIMIT` bajo — vale la pena el paso 4.