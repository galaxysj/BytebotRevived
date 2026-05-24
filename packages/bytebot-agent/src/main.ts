import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { webcrypto } from 'crypto';
import { json, urlencoded } from 'express';

function resolveLogLevels(): (
  | 'log'
  | 'error'
  | 'warn'
  | 'debug'
  | 'verbose'
)[] {
  const configured = process.env.NEST_LOG_LEVELS;
  if (configured) {
    return configured
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean) as ('log' | 'error' | 'warn' | 'debug' | 'verbose')[];
  }

  return ['log', 'error', 'warn', 'debug', 'verbose'];
}

// Polyfill for crypto global (required by @nestjs/schedule)
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}

async function bootstrap() {
  console.log('Starting bytebot-agent application...');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: resolveLogLevels(),
    });

    // Configure body parser with increased payload size limit (50MB)
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ limit: '50mb', extended: true }));

    // Enable CORS
    app.enableCors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    });

    await app.listen(process.env.PORT ?? 9991);
  } catch (error) {
    console.error('Error starting application:', error);
  }
}
bootstrap();
