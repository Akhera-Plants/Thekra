import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { UsersService } from '../users/users.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface AuthResponse {
    user: {
        id: string;
        email: string;
        displayName: string | null;
        role: string;
    };
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export declare class AuthService {
    private readonly users;
    private readonly jwt;
    private readonly config;
    private readonly accessSecret;
    private readonly refreshSecret;
    private readonly accessTtlSeconds;
    private readonly refreshTtlSeconds;
    constructor(users: UsersService, jwt: JwtService, config: ConfigService<EnvironmentVariables>);
    register(dto: RegisterDto): Promise<AuthResponse>;
    login(dto: LoginDto): Promise<AuthResponse>;
    refresh(rawRefreshToken: string): Promise<TokenPair>;
    private issueTokens;
    private safeUser;
    hashPassword(password: string): Promise<string>;
    verifyPassword(hash: string, password: string): Promise<boolean>;
}
