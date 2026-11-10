var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable, StreamableFile, } from '@nestjs/common';
import { map } from 'rxjs';
let ResponseEnvelopeInterceptor = class ResponseEnvelopeInterceptor {
    intercept(_context, next) {
        return next.handle().pipe(map((value) => {
            if (value === undefined || value === null || value instanceof StreamableFile) {
                return value;
            }
            if (typeof value === 'object' &&
                value !== null &&
                'data' in value &&
                Object.prototype.hasOwnProperty.call(value, 'data')) {
                return value;
            }
            return { data: value };
        }));
    }
};
ResponseEnvelopeInterceptor = __decorate([
    Injectable()
], ResponseEnvelopeInterceptor);
export { ResponseEnvelopeInterceptor };
//# sourceMappingURL=response-envelope.interceptor.js.map