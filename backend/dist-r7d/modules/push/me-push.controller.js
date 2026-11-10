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
import { Body, Controller, Delete, Header, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PushEndpointDto, PushSubscriptionDto, PushTestDto } from './dto/push-subscription.dto.js';
import { PushService } from './push.service.js';
let MePushController = class MePushController {
    push;
    constructor(push) {
        this.push = push;
    }
    subscribe(user, dto) {
        return this.push.subscribe(user.sub, dto);
    }
    async unsubscribe(user, dto) {
        await this.push.unsubscribe(user.sub, dto.endpoint);
    }
    async test(user, dto) {
        await this.push.sendTest(user.sub, dto.endpoint, dto.locale);
    }
};
__decorate([
    Post('subscriptions'),
    HttpCode(HttpStatus.OK),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PushSubscriptionDto]),
    __metadata("design:returntype", void 0)
], MePushController.prototype, "subscribe", null);
__decorate([
    Delete('subscriptions'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PushEndpointDto]),
    __metadata("design:returntype", Promise)
], MePushController.prototype, "unsubscribe", null);
__decorate([
    Post('test'),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PushTestDto]),
    __metadata("design:returntype", Promise)
], MePushController.prototype, "test", null);
MePushController = __decorate([
    Controller('me/push'),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [PushService])
], MePushController);
export { MePushController };
//# sourceMappingURL=me-push.controller.js.map