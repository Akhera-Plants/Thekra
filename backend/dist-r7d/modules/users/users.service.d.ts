import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
export interface CreateUserDto {
    email: string;
    passwordHash: string;
    displayName?: string;
}
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    create(dto: CreateUserDto): Promise<User>;
    deleteById(id: string): Promise<void>;
    touchLastLogin(userId: string): Promise<User>;
}
