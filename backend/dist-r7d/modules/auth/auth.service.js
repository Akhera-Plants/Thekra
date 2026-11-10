var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ConflictException, Injectable, UnauthorizedException, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash as argon2hash, verify as argon2verify } from 'argon2';
import { randomUUID } from 'node:crypto';
import { UsersService } from '../users/users.service.js';
import { ARGON2_OPTIONS, DUMMY_PASSWORD_HASH } from './password-hash.js';
function parseTtlToSeconds(ttl) {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match)
        return 900;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const map = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (map[unit] ?? 1);
}
let AuthService = class AuthService {
    users;
    jwt;
    config;
    accessSecret;
    refreshSecret;
    accessTtlSeconds;
    refreshTtlSeconds;
    constructor(users, jwt, config) {
        this.users = users;
        this.jwt = jwt;
        this.config = config;
        this.accessSecret =
            config.get('JWT_ACCESS_SECRET') ??
                'thekra-access-secret-change-in-production';
        this.refreshSecret =
            config.get('JWT_REFRESH_SECRET') ??
                'thekra-refresh-secret-change-in-production';
        const accessTtl = config.get('ACCESS_TTL') ?? '15m';
        const refreshTtl = config.get('REFRESH_TTL') ?? '30d';
        this.accessTtlSeconds = parseTtlToSeconds(accessTtl);
        this.refreshTtlSeconds = parseTtlToSeconds(refreshTtl);
    }
    async register(dto) {
        const email = dto.email.toLowerCase().trim();
        const passwordHash = await argon2hash(dto.password, ARGON2_OPTIONS);
        const existing = await this.users.findByEmail(email);
        if (existing) {
            throw new ConflictException({
                code: 'EMAIL_ALREADY_REGISTERED',
                message: 'An account with this email already exists.',
            });
        }
        const user = await this.users.create({
            email,
            passwordHash,
            displayName: dto.displayName,
        });
        void this.users.touchLastLogin(user.id);
        const tokens = this.issueTokens(user.id, user.email, user.role);
        return { user: this.safeUser(user), ...tokens };
    }
    async login(dto) {
        const email = dto.email.toLowerCase().trim();
        const user = await this.users.findByEmail(email);
        const hashToVerify = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
        const valid = await argon2verify(hashToVerify, dto.password);
        if (!user || !valid) {
            throw new UnauthorizedException({
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password.',
            });
        }
        void this.users.touchLastLogin(user.id);
        const tokens = this.issueTokens(user.id, user.email, user.role);
        return { user: this.safeUser(user), ...tokens };
    }
    async refresh(rawRefreshToken) {
        let payload;
        try {
            payload = this.jwt.verify(rawRefreshToken, {
                secret: this.refreshSecret,
            });
        }
        catch {
            throw new UnauthorizedException({
                code: 'INVALID_REFRESH_TOKEN',
                message: 'Refresh token is invalid or expired.',
            });
        }
        const user = await this.users.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException({
                code: 'INVALID_REFRESH_TOKEN',
                message: 'Refresh token is invalid or expired.',
            });
        }
        return this.issueTokens(user.id, user.email, user.role);
    }
    issueTokens(userId, email, role) {
        const jwtPayload = { sub: userId, email, role };
        const accessToken = this.jwt.sign(jwtPayload, {
            secret: this.accessSecret,
            expiresIn: this.accessTtlSeconds,
        });
        const refreshToken = this.jwt.sign({ ...jwtPayload, jti: randomUUID() }, {
            secret: this.refreshSecret,
            expiresIn: this.refreshTtlSeconds,
        });
        return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds };
    }
    safeUser(user) {
        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
        };
    }
    hashPassword(password) {
        return argon2hash(password, ARGON2_OPTIONS);
    }
    verifyPassword(hash, password) {
        return argon2verify(hash, password);
    }
};
AuthService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UsersService,
        JwtService,
        ConfigService])
], AuthService);
export { AuthService };
//# sourceMappingURL=auth.service.js.map