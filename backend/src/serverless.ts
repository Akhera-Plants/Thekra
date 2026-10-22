import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module.js';
import { configureApp } from './config/configure-app.js';

type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Vercel Function entry (see backend/api/index.mjs). Same app and the same
 * `configureApp` as `main.ts`, but it initialises Nest without binding a port
 * and hands each request to the underlying Express instance.
 *
 * The Nest app is created once per function instance and shared by every
 * invocation. A failed boot clears the cache so the next request retries.
 */
let listener: Promise<RequestListener> | undefined;

function boot(): Promise<RequestListener> {
  listener ??= (async () => {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    configureApp(app);
    await app.init();
    app.get(Logger).log('Nest application initialised (serverless cold start)');
    return app.getHttpAdapter().getInstance() as RequestListener;
  })().catch((error: unknown) => {
    listener = undefined;
    throw error;
  });
  return listener;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const handle = await boot();
  handle(req, res);
}
