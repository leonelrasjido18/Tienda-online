import { normalizePostalCode } from './postal-code';

/**
 * Elección de tarifa en la tabla manual.
 *
 * La tabla tiene dos niveles y el más específico gana:
 *   1. Código postal exacto — para cuando una localidad sale distinto que el
 *      resto de su provincia (el interior de Buenos Aires contra el conurbano,
 *      por ejemplo).
 *   2. Provincia entera — la red de seguridad, con `postalCode` vacío.
 *
 * Que sea una función pura y no una consulta SQL es a propósito: es la regla que
 * decide cuánto paga el cliente, y una regla de plata se prueba.
 */
export interface ShippingRateCandidate {
  /** Código postal al que aplica. Vacío = toda la provincia. */
  postalCode: string;
  province: string;
  priceCents: number;
  etaDays: number | null;
  isActive: boolean;
}

export interface ShippingDestination {
  postalCode: string | null;
  province: string | null;
}

function mismaProvincia(a: string, b: string | null): boolean {
  return b !== null && a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');
}

/**
 * La tarifa que corresponde al destino, o `null` si no hay ninguna cargada.
 *
 * Una tarifa por código postal aplica aunque la provincia no coincida: el código
 * postal ya identifica la localidad, y la provincia que escribe el cliente en un
 * campo libre se equivoca más seguido que su CP.
 */
export function pickShippingRate(
  rates: ShippingRateCandidate[],
  destino: ShippingDestination,
): ShippingRateCandidate | null {
  const activas = rates.filter((r) => r.isActive);
  const cp = normalizePostalCode(destino.postalCode);

  if (cp) {
    const porCodigo = activas.find((r) => normalizePostalCode(r.postalCode) === cp);
    if (porCodigo) return porCodigo;
  }

  if (destino.province) {
    const porProvincia = activas.find(
      (r) => r.postalCode.trim() === '' && mismaProvincia(r.province, destino.province),
    );
    if (porProvincia) return porProvincia;
  }

  return null;
}

/**
 * Si el envío se cobra al comprar o más adelante.
 *
 * Con stock inmediato sale ya, así que se cobra todo junto. Con encargo no: el
 * pedido viaja desde China y el envío se cotiza recién cuando llega el lote,
 * junto con el saldo. Mezclarlos obligaría a adivinar un envío con meses de
 * anticipación.
 *
 * La misma regla la usan el checkout de la API, para cobrar, y la tienda, para
 * mostrar el resumen. Si quedaran separadas, el cliente vería un total y pagaría
 * otro.
 */
export function shippingDueAtCheckout(
  plan: 'FULL' | 'DEPOSIT_BALANCE',
  opciones: { pickupInStore: boolean },
): boolean {
  if (opciones.pickupInStore) return false;
  return plan === 'FULL';
}

export interface ParsedBulkRate {
  postalCode: string;
  priceCents: number;
  etaDays: number | null;
}

export interface BulkRatesParseResult {
  rates: ParsedBulkRate[];
  /** Línea y motivo de cada fila que no se pudo leer, para mostrarlas tal cual. */
  errors: Array<{ line: number; text: string; reason: string }>;
}

/**
 * Lee el pegado de la carga masiva: una línea por código postal, con
 * `código, precio` y opcionalmente `, días`.
 *
 * Acepta coma, punto y coma o tabulación como separador, que es lo que sale al
 * copiar de una planilla. Precio en pesos enteros: nadie cobra $4500,37 de
 * envío, y aceptar decimales abre la puerta a confundir el separador de miles
 * con el decimal — `4.500` es cuatro mil quinientos acá y cuatro con medio en
 * otro lado.
 *
 * Las filas con problemas no frenan a las demás: se devuelven aparte para que
 * el panel las muestre y la dueña corrija sólo esas.
 */
export function parseBulkShippingRates(texto: string): BulkRatesParseResult {
  const rates: ParsedBulkRate[] = [];
  const errors: BulkRatesParseResult['errors'] = [];

  texto.split(/\r?\n/).forEach((cruda, i) => {
    const linea = cruda.trim();
    if (linea === '') return;

    const partes = linea.split(/[,;\t]/).map((p) => p.trim());
    const agregarError = (reason: string) => errors.push({ line: i + 1, text: linea, reason });

    if (partes.length < 2) {
      agregarError('Falta el precio');
      return;
    }

    const cp = normalizePostalCode(partes[0]);
    if (!cp) {
      agregarError('Código postal inválido');
      return;
    }

    // Se quitan los puntos de mil y el símbolo de peso, que vienen de la planilla.
    const precioCrudo = (partes[1] ?? '').replace(/[$\s.]/g, '');
    if (!/^\d+$/.test(precioCrudo)) {
      agregarError('El precio tiene que ser un número entero de pesos');
      return;
    }
    const pesos = Number(precioCrudo);
    if (pesos <= 0) {
      agregarError('El precio tiene que ser mayor a cero');
      return;
    }

    let etaDays: number | null = null;
    const diasCrudo = partes[2]?.trim();
    if (diasCrudo) {
      if (!/^\d+$/.test(diasCrudo)) {
        agregarError('Los días tienen que ser un número entero');
        return;
      }
      etaDays = Number(diasCrudo);
    }

    rates.push({ postalCode: cp, priceCents: pesos * 100, etaDays });
  });

  return { rates, errors };
}
