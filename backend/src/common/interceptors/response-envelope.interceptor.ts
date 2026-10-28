import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        // A file (e.g. the text/calendar feed) is sent as is, never wrapped in JSON.
        if (value === undefined || value === null || value instanceof StreamableFile) {
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
