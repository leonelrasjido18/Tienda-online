import { describe, expect, it } from 'vitest';

import { normalizePostalCode, samePostalCode } from './postal-code';
import { parseBulkShippingRates, pickShippingRate, type ShippingRateCandidate } from './shipping-rate';

describe('normalizePostalCode', () => {
  it('deja pasar el formato viejo de 4 dígitos', () => {
    expect(normalizePostalCode('1425')).toBe('1425');
  });

  it('extrae los 4 dígitos de un CPA completo', () => {
    expect(normalizePostalCode('C1425ABC')).toBe('1425');
  });

  it('no distingue mayúsculas ni espacios de más', () => {
    expect(normalizePostalCode('  c1425abc ')).toBe('1425');
    expect(normalizePostalCode(' 1425 ')).toBe('1425');
  });

  it('devuelve null cuando no hay nada reconocible', () => {
    expect(normalizePostalCode('')).toBeNull();
    expect(normalizePostalCode(null)).toBeNull();
    expect(normalizePostalCode(undefined)).toBeNull();
    expect(normalizePostalCode('sin número')).toBeNull();
    // Tres dígitos no alcanzan y seis no son un CP argentino.
    expect(normalizePostalCode('142')).toBeNull();
    expect(normalizePostalCode('142533')).toBeNull();
  });

  it('samePostalCode compara ya normalizado', () => {
    expect(samePostalCode('C1425ABC', '1425')).toBe(true);
    expect(samePostalCode('1425', '1426')).toBe(false);
    // Dos nulos no son "el mismo CP": no se sabe nada de ninguno.
    expect(samePostalCode(null, null)).toBe(false);
  });
});

describe('pickShippingRate', () => {
  const provincia = (province: string, priceCents: number): ShippingRateCandidate => ({
    postalCode: '',
    province,
    priceCents,
    etaDays: 5,
    isActive: true,
  });
  const codigo = (postalCode: string, priceCents: number): ShippingRateCandidate => ({
    postalCode,
    province: 'Buenos Aires',
    priceCents,
    etaDays: 2,
    isActive: true,
  });

  const tabla = [provincia('Buenos Aires', 700000), provincia('CABA', 500000), codigo('1425', 450000)];

  it('usa la tarifa de la provincia cuando no hay una más específica', () => {
    const r = pickShippingRate(tabla, { postalCode: '7600', province: 'Buenos Aires' });
    expect(r?.priceCents).toBe(700000);
  });

  it('el código postal le gana a la provincia', () => {
    const r = pickShippingRate(tabla, { postalCode: '1425', province: 'Buenos Aires' });
    expect(r?.priceCents).toBe(450000);
  });

  it('reconoce el CPA, no sólo los 4 dígitos', () => {
    const r = pickShippingRate(tabla, { postalCode: 'C1425ABC', province: 'Buenos Aires' });
    expect(r?.priceCents).toBe(450000);
  });

  it('el código postal manda aunque la provincia escrita esté mal', () => {
    // Pasa seguido: el CP es de CABA y la persona escribe "Buenos Aires".
    const r = pickShippingRate(tabla, { postalCode: '1425', province: 'Córdoba' });
    expect(r?.priceCents).toBe(450000);
  });

  it('la provincia no distingue mayúsculas ni acentos de más', () => {
    expect(pickShippingRate(tabla, { postalCode: null, province: 'caba' })?.priceCents).toBe(500000);
    expect(pickShippingRate(tabla, { postalCode: null, province: 'CABA ' })?.priceCents).toBe(500000);
  });

  it('ignora las tarifas desactivadas', () => {
    const apagada = [{ ...codigo('1425', 450000), isActive: false }, provincia('Buenos Aires', 700000)];
    const r = pickShippingRate(apagada, { postalCode: '1425', province: 'Buenos Aires' });
    expect(r?.priceCents).toBe(700000);
  });

  it('devuelve null si no hay tarifa que aplique', () => {
    expect(pickShippingRate(tabla, { postalCode: '5000', province: 'Córdoba' })).toBeNull();
    expect(pickShippingRate(tabla, { postalCode: null, province: null })).toBeNull();
    expect(pickShippingRate([], { postalCode: '1425', province: 'Buenos Aires' })).toBeNull();
  });

  it('una tarifa por código postal no se usa como tarifa de toda la provincia', () => {
    // Sólo está cargado el CP 1425; un envío a otro punto de Buenos Aires no
    // puede salir 4500 sólo porque comparten provincia.
    const soloCodigo = [codigo('1425', 450000)];
    expect(pickShippingRate(soloCodigo, { postalCode: '7600', province: 'Buenos Aires' })).toBeNull();
  });
});

describe('parseBulkShippingRates', () => {
  it('lee código, precio y días', () => {
    const r = parseBulkShippingRates('1425, 4500, 3');
    expect(r.errors).toEqual([]);
    expect(r.rates).toEqual([{ postalCode: '1425', priceCents: 450000, etaDays: 3 }]);
  });

  it('los días son opcionales', () => {
    const r = parseBulkShippingRates('7600, 7200');
    expect(r.rates).toEqual([{ postalCode: '7600', priceCents: 720000, etaDays: null }]);
  });

  it('acepta punto y coma y tabulación, que es lo que pega una planilla', () => {
    expect(parseBulkShippingRates('1425;4500').rates[0]?.priceCents).toBe(450000);
    expect(parseBulkShippingRates('1425\t4500').rates[0]?.priceCents).toBe(450000);
  });

  it('tolera el símbolo de peso y el punto de miles', () => {
    expect(parseBulkShippingRates('1425, $4.500, 3').rates[0]?.priceCents).toBe(450000);
  });

  it('normaliza el CPA a sus 4 dígitos', () => {
    expect(parseBulkShippingRates('C1425ABC, 4500').rates[0]?.postalCode).toBe('1425');
  });

  it('ignora líneas en blanco', () => {
    const r = parseBulkShippingRates('\n1425, 4500\n\n  \n7600, 7200\n');
    expect(r.rates).toHaveLength(2);
    expect(r.errors).toEqual([]);
  });

  it('una fila mala no frena a las buenas, y se informa con su número de línea', () => {
    const r = parseBulkShippingRates('1425, 4500\nchirimbolo, 3000\n7600, 7200');
    expect(r.rates).toHaveLength(2);
    expect(r.errors).toEqual([
      { line: 2, text: 'chirimbolo, 3000', reason: 'Código postal inválido' },
    ]);
  });

  it('rechaza precios que no son enteros de pesos', () => {
    // Con coma como separador de columnas, "4500,50" ya se partió en dos campos:
    // lo que llega como precio es "4500" y "50" quedaría como días. Lo que se
    // prueba acá es el caso real de un decimal escrito con coma en una sola celda.
    expect(parseBulkShippingRates('1425, 45x00').errors[0]?.reason).toContain('número entero');
    expect(parseBulkShippingRates('1425, 0').errors[0]?.reason).toContain('mayor a cero');
  });

  it('marca la falta de precio', () => {
    expect(parseBulkShippingRates('1425').errors[0]?.reason).toBe('Falta el precio');
  });

  it('rechaza días no numéricos', () => {
    expect(parseBulkShippingRates('1425, 4500, tres').errors[0]?.reason).toContain('días');
  });
});
