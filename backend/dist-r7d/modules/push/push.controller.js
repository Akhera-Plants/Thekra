var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Get, Header, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { PushService } from './push.service.js';
let PushController = class PushController {
    push;
    constructor(push) {
        this.push = push;
    }
    config() {
        return this.push.publicConfig();
    }
    deliver(signature, body) {
        return this.push.deliver(signature, body);
    }
    refill(authorization) {
        return this.push.refillAll(authorization);
    }
};
__decorate([
    Get('config'),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PushController.prototype, "config", null);
__decorate([
    Post('deliver'),
    SkipThrottle(),
    HttpCode(HttpStatus.OK),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    __param(0, Headers('upstash-signature')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PushController.prototype, "deliver", null);
__decorate([
    Get('refill'),
    SkipThrottle(),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    __param(0, Headers('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PushController.prototype, "refill", null);
PushController = __decorate([
    Controller('push'),
    __metadata("design:paramtypes", [PushService])
], PushController);
export { PushController };
//# sourceMappingURL=push.controller.js.map