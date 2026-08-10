import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

interface ErrorBody {
  message: string;
  errors?: Record<string, string[]>;
}

function isMulterError(exception: unknown): exception is { code: string; message: string } {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    (exception as { name?: string }).name === 'MulterError' &&
    typeof (exception as { code?: unknown }).code === 'string'
  );
}

function fromMulterError(exception: { code: string }): { status: number; body: ErrorBody } {
  switch (exception.code) {
    case 'LIMIT_FILE_SIZE':
      return { status: HttpStatus.PAYLOAD_TOO_LARGE, body: { message: 'El archivo es demasiado pesado' } };
    default:
      return { status: HttpStatus.BAD_REQUEST, body: { message: 'No se pudo subir el archivo' } };
  }
}

function fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): { status: number; body: ErrorBody } {
  switch (exception.code) {
    case 'P2002': {
      const target = (exception.meta?.target as string[] | undefined)?.join(', ') ?? 'campo único';
      return { status: HttpStatus.CONFLICT, body: { message: `Ya existe un registro con ese ${target}` } };
    }
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, body: { message: 'El registro no existe' } };
    case 'P2003':
      return { status: HttpStatus.BAD_REQUEST, body: { message: 'La referencia indicada no existe' } };
    default:
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { message: 'Error interno del servidor' } };
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(typeof body === 'string' ? { statusCode: status, message: body } : { statusCode: status, ...body });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const { status, body } = fromPrismaError(exception);
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(exception);
      }
      response.status(status).json({ statusCode: status, ...body });
      return;
    }

    if (isMulterError(exception)) {
      const { status, body } = fromMulterError(exception);
      response.status(status).json({ statusCode: status, ...body });
      return;
    }

    this.logger.error(exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error interno del servidor' });
  }
}
