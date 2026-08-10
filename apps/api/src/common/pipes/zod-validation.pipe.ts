import { BadRequestException, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    // Aplicado a nivel de método, @UsePipes corre este pipe para TODOS los parámetros
    // del handler (incluidos los @Param de la URL), no solo el @Body. El esquema
    // siempre describe el body, así que el resto de los parámetros pasa sin tocar.
    if (metadata.type !== 'body') {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
