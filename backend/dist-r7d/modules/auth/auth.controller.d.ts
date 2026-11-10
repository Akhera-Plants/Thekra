import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccountService } from './account.service.js';
import { AuthService } from './auth.service.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
export declare const AUTH_THROTTLE: {
    default: {
        limit: number;
        ttl: number;
    };
};
export declare const MEMBER_THROTTLE: {
    default: {
        limit: number;
        ttl: number;
    };
};
export declare class AuthController {
    private readonly authService;
    private readonly accountService;
    private readonly prisma;
    constructor(authService: AuthService, accountService: AccountService, prisma: PrismaService);
    register(dto: RegisterDto): Promise<{
        data: import("./auth.service.js").AuthResponse;
    }>;
    login(dto: LoginDto): Promise<{
        data: import("./auth.service.js").AuthResponse;
    }>;
    refresh(dto: RefreshTokenDto): Promise<{
        data: import("./auth.service.js").TokenPair;
    }>;
    me(user: JwtPayload): Promise<{
        data: {
            id: string;
            email: string;
            displayName: string | null;
            role: import("@prisma/client").$Enums.UserRole;
            favoriteCount: number;
            createdAt: Date;
        };
    }>;
    exportMe(user: JwtPayload): Promise<{
        data: import("./account.service.js").AccountExport;
    }>;
    deleteMe(user: JwtPayload, dto: DeleteAccountDto): Promise<void>;
    logout(): void;
}
