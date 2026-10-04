/**
 * Si una dirección IP es de la red interna del servidor: la propia máquina o la
 * red privada de Docker, donde corren la tienda y el panel.
 *
 * Express entrega las IPv4 a veces mapeadas a IPv6 (`::ffff:172.18.0.5`), así que
 * se normaliza antes de comparar.
 */
export function isInternalAddress(ip: string | undefined | null): boolean {
  if (!ip) return false;
  const limpia = ip.trim().toLowerCase().replace(/^::ffff:/, '');

  if (limpia === '::1') return true;

  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(limpia);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];

  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12, donde vive la red de Docker
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  return false;
}
