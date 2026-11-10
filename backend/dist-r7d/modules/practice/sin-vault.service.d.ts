import { PrismaService } from '../../prisma/prisma.service.js';
import { type PutSinVaultDto } from './dto/put-sin-vault.dto.js';
export interface SinVaultDto {
    ciphertext: string;
    iv: string;
    salt: string;
    kdf: string;
    iterations: number;
    version: number;
    updatedAt: string;
}
export declare function base64Bytes(value: string): number | null;
export declare class SinVaultService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    find(userId: string): Promise<{
        vault: SinVaultDto | null;
    }>;
    save(userId: string, dto: PutSinVaultDto): Promise<{
        version: number;
    }>;
    remove(userId: string): Promise<void>;
    private conflict;
}
