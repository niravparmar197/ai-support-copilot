import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// __Host- prefixed auth cookies (src/auth/auth.constants.ts) require
// Secure, which real browsers only honor over HTTPS — over plain HTTP the
// login response would still appear to succeed, but the browser would
// silently refuse to store the cookies. `certs/` (gitignored) is populated
// by mkcert, not committed. Missing certs fall back to plain HTTP rather
// than failing to boot, since most of the app doesn't depend on this —
// but the auth cookie flow will not work in a real browser until it's set
// up. One-time setup from backend/:
//   mkcert -install
//   mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 127.0.0.1 ::1
function loadHttpsOptions(): { key: Buffer; cert: Buffer } | undefined {
  const keyPath = join(__dirname, '..', 'certs', 'localhost-key.pem');
  const certPath = join(__dirname, '..', 'certs', 'localhost.pem');

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    console.warn(
      '[bootstrap] No TLS certs found in backend/certs — starting over plain HTTP. ' +
        '__Host- auth cookies will not be stored by real browsers until mkcert is set up (see comment in main.ts).',
    );
    return undefined;
  }

  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

async function bootstrap() {
  const httpsOptions = loadHttpsOptions();
  const app = await NestFactory.create(
    AppModule,
    httpsOptions ? { httpsOptions } : undefined,
  );
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: configService.getOrThrow<string>('CORS_ORIGIN'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  if (configService.getOrThrow<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AI Support Copilot API')
      .setDescription('API documentation for the AI Support Copilot backend')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port);
}
bootstrap();