import { describe, expect, it } from 'vitest';

import { isInternalAddress } from './internal-network';

describe('isInternalAddress', () => {
  it('reconoce la red de Docker, donde corre la tienda', () => {
    // 172.18.0.5 es la dirección real desde la que la tienda le pedía datos a la API.
    expect(isInternalAddress('172.18.0.5')).toBe(true);
    expect(isInternalAddress('172.16.0.1')).toBe(true);
    expect(isInternalAddress('172.31.255.254')).toBe(true);
  });

  it('entiende las IPv4 mapeadas a IPv6 que entrega Express', () => {
    expect(isInternalAddress('::ffff:172.18.0.5')).toBe(true);
    expect(isInternalAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('reconoce la propia máquina y las redes privadas', () => {
    expect(isInternalAddress('127.0.0.1')).toBe(true);
    expect(isInternalAddress('::1')).toBe(true);
    expect(isInternalAddress('10.1.2.3')).toBe(true);
    expect(isInternalAddress('192.168.1.20')).toBe(true);
  });

  it('no confunde direcciones públicas parecidas', () => {
    // Justo afuera del rango 172.16.0.0/12 y de las demás redes privadas.
    expect(isInternalAddress('172.15.0.1')).toBe(false);
    expect(isInternalAddress('172.32.0.1')).toBe(false);
    expect(isInternalAddress('192.169.1.1')).toBe(false);
    expect(isInternalAddress('11.0.0.1')).toBe(false);
    // Una dirección pública cualquiera, como la de un rastreador.
    expect(isInternalAddress('47.128.51.70')).toBe(false);
    expect(isInternalAddress('190.2.125.36')).toBe(false);
  });

  it('rechaza lo que no es una dirección', () => {
    expect(isInternalAddress(undefined)).toBe(false);
    expect(isInternalAddress(null)).toBe(false);
    expect(isInternalAddress('')).toBe(false);
    expect(isInternalAddress('172.18.0')).toBe(false);
    expect(isInternalAddress('172.18.0.5.9')).toBe(false);
    expect(isInternalAddress('localhost')).toBe(false);
  });
});
