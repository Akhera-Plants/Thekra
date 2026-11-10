var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
let AdminApiKeyGuard = class AdminApiKeyGuard {
    config;
    constructor(config) {
        this.config = config;
    }
    canActivate(context) {
        const apiKey = this.config.get('ADMIN_API_KEY');
        if (!apiKey) {
            const nodeEnv = this.config.get('NODE_ENV');
            if (nodeEnv === 'production') {
                throw new ForbiddenException({
                    code: 'FORBIDDEN',
                    message: 'Admin access requires authentication in production. Set ADMIN_API_KEY.',
                });
            }
            return true;
        }
        const req = context.switchToHttp().getRequest();
        const header = req.headers['x-admin-key'];
        if (header !== apiKey) {
            throw new ForbiddenException({
                code: 'FORBIDDEN',
                message: 'Invalid or missing x-admin-key header',
            });
        }
        return true;
    }
};
AdminApiKeyGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [ConfigService])
], AdminApiKeyGuard);
export { AdminApiKeyGuard };
//# sourceMappingURL=admin-api-key.guard.js.map