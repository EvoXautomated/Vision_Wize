import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

/** Todas las respuestas no-2xx llevan el cuerpo `{ "message": "..." }`. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, message] = this.resolve(err);
    if (status >= 500) this.logger.error(err);
    // Datos extra del error (p. ej. `duplicates`, `mergedIntoId`) para la app.
    const body = err instanceof HttpException ? err.getResponse() : null;
    const extra =
      body && typeof body === 'object'
        ? Object.fromEntries(
            Object.entries(body).filter(([k]) => !['message', 'statusCode', 'error'].includes(k)),
          )
        : {};
    res.status(status).json({ ...extra, message });
  }

  private resolve(err: unknown): [number, string] {
    if (err instanceof HttpException) {
      const body = err.getResponse();
      const raw =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? err.message);
      return [err.getStatus(), Array.isArray(raw) ? raw.join('; ') : raw];
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return [HttpStatus.CONFLICT, 'Ese valor ya existe'];
      if (err.code === 'P2025') return [HttpStatus.NOT_FOUND, 'No encontrado'];
    }
    // Errores de body-parser (JSON mal formado, payload demasiado grande).
    const status = (err as { status?: number })?.status;
    if (status && status >= 400 && status < 500) {
      return [status, (err as Error).message];
    }
    return [HttpStatus.INTERNAL_SERVER_ERROR, 'Error interno del servidor'];
  }
}
