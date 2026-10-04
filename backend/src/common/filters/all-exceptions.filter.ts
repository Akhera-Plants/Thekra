import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const requestId =
      (typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : undefined) ??
      request.id ??
      randomUUID();

    const { status, code, message, details } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        { requestId, err: exception },
        message,
      );
    }

    const body: ApiErrorBody = {
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

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details: unknown;
  } {
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
      const obj = res as Record<string, unknown>;
      const message =
        typeof obj.message === 'string'
          ? obj.message
          : Array.isArray(obj.message)
            ? 'Request validation failed'
            : exception.message;
      const code =
        typeof obj.code === 'string'
          ? obj.code
          : status === HttpStatus.BAD_REQUEST && Array.isArray(obj.message)
            ? 'VALIDATION_FAILED'
            : this.codeFromStatus(status);
      const details =
        Array.isArray(obj.message)
          ? obj.message
          : (obj.details ?? null);
      return { status, code, message, details };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: null,
    };
  }

  private fromPrisma(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
    details: unknown;
  } {
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

  private codeFromStatus(status: number): string {
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
}
