var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
import { Catch, HttpException, HttpStatus, Logger, } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    logger = new Logger(AllExceptionsFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const requestId = request.id ?? randomUUID();
        const { status, code, message, details } = this.normalize(exception);
        if (status >= 500) {
            this.logger.error({ requestId, err: exception }, message);
        }
        const body = {
            error: {
                code,
                message,
                details,
                path: request.url,
                method: request.method,
                requestId,
                timestamp: new Date().toISOString(),
            },
        };
        response.status(status).json(body);
    }
    normalize(exception) {
        if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            return this.fromPrisma(exception);
        }
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                return {
                    status,
                    code: this.codeFromStatus(status),
                    message: res,
                    details: null,
                };
            }
            const obj = res;
            const message = typeof obj.message === 'string'
                ? obj.message
                : Array.isArray(obj.message)
                    ? 'Request validation failed'
                    : exception.message;
            const code = typeof obj.code === 'string'
                ? obj.code
                : status === HttpStatus.BAD_REQUEST && Array.isArray(obj.message)
                    ? 'VALIDATION_FAILED'
                    : this.codeFromStatus(status);
            const details = obj.details !== undefined
                ? obj.details
                : Array.isArray(obj.message)
                    ? obj.message
                    : null;
            return { status, code, message, details };
        }
        if (exception instanceof Prisma.PrismaClientValidationError) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: 'VALIDATION_FAILED',
                message: 'Request validation failed',
                details: null,
            };
        }
        const httpLike = exception;
        const clientStatus = httpLike.status ?? httpLike.statusCode;
        if (typeof clientStatus === 'number' &&
            clientStatus >= 400 &&
            clientStatus < 500 &&
            httpLike.expose === true) {
            return {
                status: clientStatus,
                code: this.codeFromClientStatus(clientStatus, httpLike.type),
                message: this.genericClientMessage(clientStatus),
                details: null,
            };
        }
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: null,
        };
    }
    codeFromClientStatus(status, type) {
        if (status === HttpStatus.PAYLOAD_TOO_LARGE)
            return 'PAYLOAD_TOO_LARGE';
        if (status === HttpStatus.UNSUPPORTED_MEDIA_TYPE) {
            return 'UNSUPPORTED_MEDIA_TYPE';
        }
        if (status === HttpStatus.BAD_REQUEST) {
            return type === 'entity.parse.failed'
                ? 'MALFORMED_JSON'
                : 'VALIDATION_FAILED';
        }
        return this.codeFromStatus(status);
    }
    genericClientMessage(status) {
        if (status === HttpStatus.PAYLOAD_TOO_LARGE)
            return 'Request body too large';
        if (status === HttpStatus.UNSUPPORTED_MEDIA_TYPE) {
            return 'Unsupported media type';
        }
        if (status === HttpStatus.BAD_REQUEST)
            return 'Malformed request body';
        return 'Bad request';
    }
    fromPrisma(error) {
        switch (error.code) {
            case 'P2002':
                return {
                    status: HttpStatus.CONFLICT,
                    code: 'RESOURCE_ALREADY_EXISTS',
                    message: 'Resource already exists',
                    details: error.meta ?? null,
                };
            case 'P2003':
                return {
                    status: HttpStatus.UNPROCESSABLE_ENTITY,
                    code: 'RELATED_RESOURCE_INVALID',
                    message: 'Related resource is invalid',
                    details: error.meta ?? null,
                };
            case 'P2025':
                return {
                    status: HttpStatus.NOT_FOUND,
                    code: 'RESOURCE_NOT_FOUND',
                    message: 'Resource not found',
                    details: error.meta ?? null,
                };
            default:
                return {
                    status: HttpStatus.INTERNAL_SERVER_ERROR,
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    details: null,
                };
        }
    }
    codeFromStatus(status) {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return 'VALIDATION_FAILED';
            case HttpStatus.UNAUTHORIZED:
                return 'UNAUTHENTICATED';
            case HttpStatus.FORBIDDEN:
                return 'FORBIDDEN';
            case HttpStatus.NOT_FOUND:
                return 'RESOURCE_NOT_FOUND';
            case HttpStatus.CONFLICT:
                return 'RESOURCE_ALREADY_EXISTS';
            case HttpStatus.UNPROCESSABLE_ENTITY:
                return 'RELATED_RESOURCE_INVALID';
            case HttpStatus.TOO_MANY_REQUESTS:
                return 'RATE_LIMIT_EXCEEDED';
            default:
                return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
        }
    }
};
AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    Catch()
], AllExceptionsFilter);
export { AllExceptionsFilter };
//# sourceMappingURL=all-exceptions.filter.js.map