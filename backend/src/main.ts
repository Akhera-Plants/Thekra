import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './config/configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
  app.get(Logger).log(`Listening on port ${port}`);
}

await bootstrap();
