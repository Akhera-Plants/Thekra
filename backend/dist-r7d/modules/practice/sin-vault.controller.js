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
import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PutSinVaultDto } from './dto/put-sin-vault.dto.js';
import { SinVaultService } from './sin-vault.service.js';
let SinVaultController = class SinVaultController {
    sinVault;
    constructor(sinVault) {
        this.sinVault = sinVault;
    }
    find(user) {
        return this.sinVault.find(user.sub);
    }
    save(user, dto) {
        return this.sinVault.save(user.sub, dto);
    }
    async remove(user) {
        await this.sinVault.remove(user.sub);
    }
};
__decorate([
    Get(),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SinVaultController.prototype, "find", null);
__decorate([
    Put(),
    HttpCode(HttpStatus.OK),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PutSinVaultDto]),
    __metadata("design:returntype", void 0)
], SinVaultController.prototype, "save", null);
__decorate([
    Delete(),
    HttpCode(HttpStatus.NO_CONTENT),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SinVaultController.prototype, "remove", null);
SinVaultController = __decorate([
    Controller('me/sin-vault'),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [SinVaultService])
], SinVaultController);
export { SinVaultController };
//# sourceMappingURL=sin-vault.controller.js.map