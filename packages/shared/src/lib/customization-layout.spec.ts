import { describe, expect, it } from 'vitest';

import { computeFontSizeForBox, resolvePrintArea } from './customization-layout';

describe('resolvePrintArea', () => {
  it('convierte coordenadas normalizadas a píxeles', () => {
    const box = resolvePrintArea({ x: 0.25, y: 0.1, width: 0.5, height: 0.2, rotation: 0, align: 'center' }, 1000, 800);
    expect(box).toEqual({ left: 250, top: 80, width: 500, height: 160, rotation: 0, align: 'center' });
  });
});

describe('computeFontSizeForBox', () => {
  it('devuelve el alto de la caja cuando el texto está vacío', () => {
    expect(computeFontSizeForBox('', { width: 300, height: 50 })).toBe(50);
  });

  it('respeta el alto de la caja cuando el texto es corto', () => {
    const size = computeFontSizeForBox('10', { width: 300, height: 50 });
    expect(size).toBe(50);
  });

  it('reduce el tamaño cuando el texto es largo para el ancho disponible', () => {
    const size = computeFontSizeForBox('MESSI CAMPEON DEL MUNDO', { width: 300, height: 80 });
    expect(size).toBeLessThan(80);
    expect(size).toBeGreaterThanOrEqual(8);
  });

  it('nunca devuelve menos que el tamaño mínimo', () => {
    const size = computeFontSizeForBox('UN NOMBRE MUY MUY LARGO PARA LA CAJA', { width: 20, height: 80 });
    expect(size).toBe(8);
  });
});
