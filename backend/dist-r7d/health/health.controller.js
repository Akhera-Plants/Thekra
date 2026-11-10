var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, ServiceUnavailableException, } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
const APP_VERSION = JSON.parse(readFileSync(join(import.meta.dirname, '../../package.json'), 'utf-8')).version;
const startedAt = Date.now();
let HealthController = class HealthController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    liveness() {
        return {
            status: 'ok',
            uptime: Math.floor((Date.now() - startedAt) / 1000),
            version: APP_VERSION,
        };
    }
    async readiness() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return {
                status: 'ok',
                checks: { database: 'up' },
            };
        }
        catch {
            throw new ServiceUnavailableException({
                code: 'SERVICE_UNAVAILABLE',
                message: 'Service not ready',
                details: { status: 'error', checks: { database: 'down' } },
            });
        }
    }
};
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "liveness", null);
__decorate([
    Get('ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "readiness", null);
HealthController = __decorate([
    Controller('health'),
    __metadata("design:paramtypes", [PrismaService])
], HealthController);
export { HealthController };
//# sourceMappingURL=health.controller.js.map