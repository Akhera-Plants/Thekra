var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable, mixin, PayloadTooLargeException } from '@nestjs/common';
export function MaxBodyBytes(limit) {
    let MaxBodyBytesGuard = class MaxBodyBytesGuard {
        canActivate(context) {
            const req = context.switchToHttp().getRequest();
            const declared = Number(req.headers['content-length']);
            const size = Number.isFinite(declared) && declared >= 0
                ? declared
                : Buffer.byteLength(req.body === undefined ? '' : JSON.stringify(req.body), 'utf8');
            if (size > limit) {
                throw new PayloadTooLargeException({ code: 'PAYLOAD_TOO_LARGE', message: `The request body must be at most ${limit} bytes` });
            }
            return true;
        }
    };
    MaxBodyBytesGuard = __decorate([
        Injectable()
    ], MaxBodyBytesGuard);
    return mixin(MaxBodyBytesGuard);
}
//# sourceMappingURL=max-body-bytes.guard.js.map