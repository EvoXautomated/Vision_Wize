import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { ApiExceptionFilter } from './api-exception.filter.js';

/** Configuración compartida por main.ts y los tests e2e. */
export function configureApp(app: NestExpressApplication) {
  // Cabeceras de seguridad. Sin CSP: la API solo sirve JSON, la documentación y la página de baja.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useBodyParser('json', { limit: '5mb' }); // importación de clientes
  app.useBodyParser('text', { limit: '5mb', type: 'text/csv' });
  // Avisos de Twilio (entrega y respuestas STOP) llegan como formulario.
  app.useBodyParser('urlencoded', { extended: false, limit: '100kb' });
  const origins = (process.env.CORS_ORIGIN ?? '*')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: origins.includes('*') ? '*' : origins,
    exposedHeaders: ['Content-Disposition'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  return app;
}
