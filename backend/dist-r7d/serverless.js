import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './config/configure-app.js';
let listener;
function boot() {
    listener ??= (async () => {
        const app = await NestFactory.create(AppModule, { bufferLogs: true });
        configureApp(app);
        await app.init();
        app.get(Logger).log('Nest application initialised (serverless cold start)');
        return app.getHttpAdapter().getInstance();
    })().catch((error) => {
        listener = undefined;
        throw error;
    });
    return listener;
}
export default async function handler(req, res) {
    const handle = await boot();
    handle(req, res);
}
//# sourceMappingURL=serverless.js.map