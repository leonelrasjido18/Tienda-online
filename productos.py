#!/usr/bin/env python3
"""
Sube productos a admin.remerasdelarea.com automatizando el formulario
manual del panel de gestión, a partir de las carpetas descargadas del
catálogo del proveedor (ver yupoo_downloader.py / D:\\Fotos camisetas).

⚠️ ESTO ES UN ESQUELETO. El panel de admin está detrás de login, así que
no pude ver los selectores reales del formulario. Los pasos de "llenar
formulario" están marcados con TODO — la forma más rápida de completarlos
es con `playwright codegen`, ver README.md.

Requiere:
    pip install playwright
    playwright install chromium
"""

import re
import json
import logging
import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

# ----------------------- CONFIG -----------------------
PRODUCTS_DIR = Path(r"D:\Fotos camisetas\versión del reproductor [球员版]")
ADMIN_URL = "https://admin.remerasdelarea.com"
NEW_PRODUCT_URL = f"{ADMIN_URL}/dashboard/productos/nuevo"

STATE_FILE = PRODUCTS_DIR / "_carga_state.json"
LOG_FILE = PRODUCTS_DIR / "_carga_log.txt"
SCREENSHOTS_DIR = PRODUCTS_DIR / "_errores"

# Carpeta persistente del navegador
BROWSER_PROFILE_DIR = Path("./playwright_profile")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

TALLES = ["S", "M", "L", "XL", "2XL"]
PRECIO_VARIANTE = "42000"
COSTO_NOMBRE = "3500"
COSTO_DORSAL = "3500"
DIAS_ESPERA = "21"

USER_EMAIL = "leonelivanrasjido@gmail.com"
USER_PASS = "KcnrQKJroXYX"

# Límite de prueba. Cambiar a None para procesar todo el catálogo.
LIMIT = None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(LOG_FILE, encoding="utf-8")],
)
log = logging.getLogger(__name__)


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"cargados": {}, "login_confirmado": False}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def quitar_tildes(texto: str) -> str:
    reemplazos = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U'
    }
    for acento, sin_acento in reemplazos.items():
        texto = texto.replace(acento, sin_acento)
    return texto


def nombre_producto(carpeta: str) -> str:
    """Limpia el nombre del producto quitando tildes, corchetes en chino,
    patrones de talles (S-2XL, S-3XL, etc.) y palabras como 'jugador'."""
    # 1. Quitar corchetes y su contenido al final: [2026库拉索客场S-3XL]
    nombre = re.sub(r"\s*\[.*\]\s*$", "", carpeta).strip()

    # 2. Quitar patrones de talles (S-2XL, S-3XL, S-4XL, S-5XL, S-XL, S-M, S一2XL, 3XL, 2XL, etc.)
    nombre = re.sub(r"(?i)\bS\s*[-–—一,，\s]*\s*(?:[1-5]?X*L|M|S)\b", "", nombre)
    nombre = re.sub(r"(?i)\bS\s*(?:[1-5]?X*L|M)\b", "", nombre)
    nombre = re.sub(r"(?i)\b[1-5]?X*L\b", "", nombre)

    # 3. Quitar palabras como 'jugador', 'jugadores', 'versión jugador', 'reproductor', etc.
    nombre = re.sub(r"(?i)\b(?:versión\s+(?:del\s+)?(?:jugador|reproductor)|jugador(?:es)?|reproductor)\b", "", nombre)

    # 4. Quitar caracteres chinos sobrantes
    nombre = re.sub(r"[\u4e00-\u9fff]+", "", nombre)

    # 5. Quitar tildes / acentos
    nombre = quitar_tildes(nombre)

    # 6. Limpieza final de espacios duplicados y puntuación sobrante
    nombre = re.sub(r"\s+", " ", nombre).strip(" ,.-–—,，")
    return nombre


def generar_slug(nombre: str) -> str:
    """Genera un slug URL válido como '26-27-barcelona-azul'."""
    s = nombre.lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s


def buscar_productos(base_dir: Path):
    """Recorre la estructura de carpetas de productos (soporta directo
    o subcategorías) y devuelve (nombre_limpio, carpeta_dir, imagenes)."""
    productos = []
    if not base_dir.exists():
        log.error(f"La carpeta {base_dir} no existe.")
        return productos

    for item in sorted(base_dir.iterdir()):
        if not item.is_dir() or item.name.startswith("_"):
            continue
        imagenes_directas = sorted(
            f for f in item.iterdir()
            if f.is_file() and f.suffix.lower() in IMAGE_EXTS
        )
        if imagenes_directas:
            nombre = nombre_producto(item.name)
            productos.append((nombre, item, imagenes_directas))
        else:
            for subitem in sorted(item.iterdir()):
                if not subitem.is_dir() or subitem.name.startswith("_"):
                    continue
                imagenes_sub = sorted(
                    f for f in subitem.iterdir()
                    if f.is_file() and f.suffix.lower() in IMAGE_EXTS
                )
                if imagenes_sub:
                    nombre = nombre_producto(subitem.name)
                    productos.append((nombre, subitem, imagenes_sub))
    return productos


def login_if_needed(page):
    if "login" in page.url:
        log.info("Iniciando sesión automática en el panel...")
        page.get_by_role("textbox", name="Email").fill(USER_EMAIL)
        page.get_by_role("textbox", name="Contraseña").fill(USER_PASS)
        page.get_by_role("button", name="Ingresar").click()
        page.wait_for_load_state("networkidle")


def ir_a_nuevo_producto(page):
    page.goto(NEW_PRODUCT_URL)
    page.wait_for_load_state("networkidle")
    login_if_needed(page)

    if "dashboard/productos/nuevo" not in page.url:
        page.goto(NEW_PRODUCT_URL)
        page.wait_for_load_state("networkidle")


def cargar_producto(page, nombre, imagenes, talles):
    # 1. Navegar al formulario de nuevo producto
    ir_a_nuevo_producto(page)

    # 2. Nombre del producto
    page.get_by_role("textbox", name="Nombre").fill(nombre)

    # 3. Slug (requerido por el formulario)
    slug = generar_slug(nombre)
    try:
        page.get_by_role("textbox", name="Slug").fill(slug)
    except Exception:
        try:
            page.locator("input[name='slug']").fill(slug)
        except Exception:
            pass

    # 4. Crear producto
    page.get_by_role("button", name="Crear producto").click()
    page.wait_for_load_state("networkidle")

    # 3. Estado "Activo"
    try:
        page.get_by_role("combobox").filter(has_text="Borrador").click()
        page.get_by_label("Activo").get_by_text("Activo").click()
    except Exception:
        pass

    # 4. Tipo "Solo por encargo"
    try:
        page.get_by_role("combobox").filter(has_text="Solo con stock").click()
        page.get_by_label("Solo por encargo").get_by_text("Solo por encargo").click()
    except Exception:
        pass

    # 5. Días estimados de espera
    try:
        page.get_by_role("spinbutton", name="Días estimados de espera (por").fill(DIAS_ESPERA)
    except Exception:
        pass

    # 6. Categoría "CAMISETAS"
    try:
        target_cat = None
        for sel in [
            page.get_by_role("combobox").filter(has_text="Sin categoría"),
            page.locator("button").filter(has_text="Sin categoría"),
            page.get_by_text("Sin categoría")
        ]:
            if sel.count() > 0 and sel.first.is_visible():
                target_cat = sel.first
                break

        if target_cat:
            target_cat.click()
            page.wait_for_timeout(300)
            page.keyboard.press("ArrowDown")
            page.wait_for_timeout(200)
            page.keyboard.press("Enter")
            page.wait_for_timeout(400)
    except Exception as e:
        log.warning(f"No se pudo seleccionar la categoría CAMISETAS: {e}")

    # Guardar datos generales y opciones
    try:
        btn_guardar = page.get_by_role("button", name="Guardar datos generales")
        if btn_guardar.is_visible():
            btn_guardar.click()
            page.wait_for_timeout(800)
    except Exception:
        pass

    try:
        btn_opciones = page.get_by_role("button", name="Guardar opciones")
        if btn_opciones.is_visible():
            btn_opciones.click()
            page.wait_for_timeout(800)
    except Exception:
        pass

    # 7. Subir únicamente la foto 003
    fotos_003 = [img for img in imagenes if img.stem == "003" or img.name.startswith("003")]
    if not fotos_003 and len(imagenes) > 3:
        # Fallback a la 4ª imagen si las fotos tienen otra nomenclatura
        fotos_003 = [imagenes[3]]

    for img in fotos_003:
        try:
            log.info(f"Subiendo foto 003: {img.name}")
            page.get_by_role("button", name="Subir foto").click()
            page.locator('input[type="file"]').set_input_files(str(img))
            page.wait_for_timeout(1000)
        except Exception as e:
            log.warning(f"No se pudo subir la foto {img.name}: {e}")

    # 8. Generar variantes
    try:
        page.get_by_role("button", name="Generar variantes").click()
        page.wait_for_timeout(2000)
    except Exception:
        pass

    # 9. Completar precio de $42.000 para TODAS las variantes (S, M, L, XL, XXL)
    try:
        page.wait_for_selector("table tbody tr", timeout=5000)
        filas = page.locator("table tbody tr")
        total_filas = filas.count()
        log.info(f"Asignando precio ${PRECIO_VARIANTE} a las {total_filas} variantes...")
        for i in range(total_filas):
            fila = filas.nth(i)
            inputs = fila.locator("input")
            if inputs.count() >= 2:
                inputs.nth(1).fill(PRECIO_VARIANTE)
            else:
                fila.locator("td:nth-child(3) input").fill(PRECIO_VARIANTE)
    except Exception as e:
        log.warning(f"No se pudo asignar precio a las variantes: {e}")

    try:
        page.get_by_role("button", name="Guardar cambios de la grilla").click()
    except Exception:
        pass

    # 9. Personalización
    try:
        page.get_by_role("textbox", name="Costo extra nombre (ARS)").fill(COSTO_NOMBRE)
        page.get_by_role("textbox", name="Costo extra dorsal (ARS)").fill(COSTO_DORSAL)
        page.get_by_role("button", name="Guardar personalización").click()
    except Exception:
        pass


def main():
    PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS_DIR.mkdir(exist_ok=True)
    state = load_state()

    productos = buscar_productos(PRODUCTS_DIR)
    pendientes = [p for p in productos if p[1].name not in state["cargados"]]
    if LIMIT:
        pendientes = pendientes[:LIMIT]
    log.info(f"{len(productos)} productos encontrados en {PRODUCTS_DIR}, {len(pendientes)} a cargar en esta corrida (LIMIT={LIMIT})")

    if not pendientes:
        log.info("No hay productos pendientes por cargar.")
        return

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            str(BROWSER_PROFILE_DIR), headless=False
        )
        page = context.new_page()

        page.goto(ADMIN_URL)
        login_if_needed(page)

        for idx, (nombre, carpeta, imagenes) in enumerate(pendientes, 1):
            try:
                log.info(f"[{idx}/{len(pendientes)}] Cargando: {nombre} ({len(imagenes)} imágenes)")
                cargar_producto(page, nombre, imagenes, TALLES)
                state["cargados"][carpeta.name] = datetime.datetime.now().isoformat()
                log.info(f"[{idx}/{len(pendientes)}] ¡Cargado con éxito!: {nombre}")
            except Exception as e:
                log.error(f"Error cargando '{nombre}': {e}")
                page.screenshot(path=str(SCREENSHOTS_DIR / f"{carpeta.name}.png"))
            if idx % 20 == 0:
                save_state(state)

        save_state(state)
        context.close()

    log.info("Proceso finalizado.")


if __name__ == "__main__":
    main()