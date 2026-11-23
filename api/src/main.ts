import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './common/configure-app.js';

async function bootstrap() {
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false }),
  );
  const swagger = process.env.SWAGGER_ENABLED ?? String(process.env.NODE_ENV !== 'production');
  if (swagger === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Óptica CRM API')
      .setDescription('Fase 1: clientes, equipo, visitas, agenda y seguimiento automático.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
  }
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
