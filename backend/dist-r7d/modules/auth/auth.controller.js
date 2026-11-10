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
import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Post, UseGuards, } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccountService } from './account.service.js';
import { AuthService } from './auth.service.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
export const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
const REFRESH_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
export const MEMBER_THROTTLE = { default: { limit: 120, ttl: 60_000 } };
let AuthController = class AuthController {
    authService;
    accountService;
    prisma;
    constructor(authService, accountService, prisma) {
        this.authService = authService;
        this.accountService = accountService;
        this.prisma = prisma;
    }
    async register(dto) {
        const result = await this.authService.register(dto);
        return { data: result };
    }
    async login(dto) {
        const result = await this.authService.login(dto);
        return { data: result };
    }
    async refresh(dto) {
        const tokens = await this.authService.refresh(dto.refreshToken);
        return { data: tokens };
    }
    async me(user) {
        const [dbUser, favoriteCount] = await Promise.all([
            this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } }),
            this.prisma.favorite.count({ where: { userId: user.sub } }),
        ]);
        return {
            data: {
                id: dbUser.id,
                email: dbUser.email,
                displayName: dbUser.displayName,
                role: dbUser.role,
                favoriteCount,
                createdAt: dbUser.createdAt,
            },
        };
    }
    async exportMe(user) {
        return { data: await this.accountService.exportAccount(user.sub) };
    }
    async deleteMe(user, dto) {
        await this.accountService.deleteAccount(user.sub, dto.password);
    }
    logout() {
    }
};
__decorate([
    Post('register'),
    HttpCode(HttpStatus.CREATED),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    Post('login'),
    HttpCode(HttpStatus.OK),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    Post('refresh'),
    HttpCode(HttpStatus.OK),
    Throttle(REFRESH_THROTTLE),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RefreshTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    Get('me'),
    UseGuards(JwtAuthGuard),
    Throttle(MEMBER_THROTTLE),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    Get('me/export'),
    UseGuards(JwtAuthGuard),
    Header('Cache-Control', PRIVATE_CACHE_HEADER),
    Header('Content-Disposition', 'attachment; filename="thekra-export.json"'),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "exportMe", null);
__decorate([
    Delete('me'),
    UseGuards(JwtAuthGuard),
    HttpCode(HttpStatus.NO_CONTENT),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, DeleteAccountDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "deleteMe", null);
__decorate([
    Post('logout'),
    UseGuards(JwtAuthGuard),
    Throttle(MEMBER_THROTTLE),
    HttpCode(HttpStatus.NO_CONTENT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
AuthController = __decorate([
    Controller('auth'),
    Throttle(AUTH_THROTTLE),
    __metadata("design:paramtypes", [AuthService,
        AccountService,
        PrismaService])
], AuthController);
export { AuthController };
//# sourceMappingURL=auth.controller.js.map