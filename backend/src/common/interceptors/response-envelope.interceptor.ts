import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (value === undefined || value === null) {
          return value;
        }
        if (
          typeof value === 'object' &&
          value !== null &&
          'data' in value &&
          Object.prototype.hasOwnProperty.call(value, 'data')
        ) {
          return value;
        }
        return { data: value };
      }),
    );
  }
}
