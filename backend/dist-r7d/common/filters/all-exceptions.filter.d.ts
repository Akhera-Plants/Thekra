import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export interface ApiErrorBody {
    error: {
        code: string;
        message: string;
        details: unknown;
        path: string;
        method: string;
        requestId: string;
        timestamp: string;
    };
}
export declare class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger;
    catch(exception: unknown, host: ArgumentsHost): void;
    private normalize;
    private codeFromClientStatus;
    private genericClientMessage;
    private fromPrisma;
    private codeFromStatus;
}
