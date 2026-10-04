import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { isInternalAddress } from './internal-network';

/**
 * El límite de pedidos existe para frenar a personas: fuerza bruta en el login,
 * pedidos masivos en el checkout. No para frenar a la propia tienda.
 *
 * La tienda arma sus páginas pidiéndole el catálogo a la API desde adentro del
 * servidor, así que para el limitador *todos* los visitantes son una sola
 * dirección y comparten el mismo cupo de 100 pedidos por minuto en cada ruta. Una
 * ficha usa tres rutas (detalle, relacionados, reseñas). Un rastreador de
 * internet recorriendo el catálogo agotaba el cupo y desde ese momento cualquier
 * cliente que abriera una ficha veía una pantalla de error. El viernes 2/10 fueron
 * 2.649 pedidos rechazados.
 *
 * Se saltea el límite sólo para lecturas (GET) que llegan desde la red interna.
 * Un visitante de afuera nunca aparece con una dirección interna: `trust proxy`
 * toma la IP que ve nginx, y los intentos de falsificar X-Forwarded-For quedan
 * detrás de ella. Los endpoints sensibles (login, checkout, cupones) los llama el
 * navegador desde su propia IP, así que siguen limitados.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ method?: string; ip?: string }>();
    return req.method === 'GET' && isInternalAddress(req.ip);
  }
}
