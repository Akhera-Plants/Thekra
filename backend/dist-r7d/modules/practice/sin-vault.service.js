var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, ConflictException, Injectable, NotFoundException, PayloadTooLargeException, } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SIN_VAULT_MAX_CIPHERTEXT_BYTES } from './dto/put-sin-vault.dto.js';
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const IV_BYTES = 12;
const SALT_BYTES = 16;
export function base64Bytes(value) {
    if (value.length === 0 || !BASE64.test(value))
        return null;
    return Buffer.from(value, 'base64').length;
}
function invalid(message) {
    return new BadRequestException({ code: 'SIN_VAULT_INVALID', message });
}
let SinVaultService = class SinVaultService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async find(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { sinVault: true } });
        if (!user)
            throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' });
        const vault = user.sinVault;
        return {
            vault: vault
                ? {
                    ciphertext: vault.ciphertext,
                    iv: vault.iv,
                    salt: vault.salt,
                    kdf: vault.kdf,
                    iterations: vault.iterations,
                    version: vault.version,
                    updatedAt: vault.updatedAt.toISOString(),
                }
                : null,
        };
    }
    async save(userId, dto) {
        const ciphertextBytes = base64Bytes(dto.ciphertext);
        if (ciphertextBytes === null)
            throw invalid('ciphertext must be base64');
        if (ciphertextBytes > SIN_VAULT_MAX_CIPHERTEXT_BYTES) {
            throw new PayloadTooLargeException({
                code: 'SIN_VAULT_TOO_LARGE',
                message: `The vault ciphertext may be at most ${SIN_VAULT_MAX_CIPHERTEXT_BYTES} bytes`,
            });
        }
        if (base64Bytes(dto.iv) !== IV_BYTES)
            throw invalid(`iv must be ${IV_BYTES} bytes, base64`);
        if (base64Bytes(dto.salt) !== SALT_BYTES)
            throw invalid(`salt must be ${SALT_BYTES} bytes, base64`);
        const data = { ciphertext: dto.ciphertext, iv: dto.iv, salt: dto.salt, kdf: dto.kdf, iterations: dto.iterations };
        const version = dto.version + 1;
        if (dto.version === 0) {
            try {
                await this.prisma.sinVault.create({ data: { userId, ...data, version } });
                return { version };
            }
            catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
                    throw await this.conflict(userId);
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                    throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' });
                }
                throw error;
            }
        }
        const { count } = await this.prisma.sinVault.updateMany({ where: { userId, version: dto.version }, data: { ...data, version } });
        if (count === 0)
            throw await this.conflict(userId);
        return { version };
    }
    async remove(userId) {
        await this.prisma.sinVault.deleteMany({ where: { userId } });
    }
    async conflict(userId) {
        const { vault } = await this.find(userId);
        return new ConflictException({
            code: 'SIN_VAULT_CONFLICT',
            message: 'The sin vault changed since it was read; open the current one, merge and retry',
            details: { vault },
        });
    }
};
SinVaultService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], SinVaultService);
export { SinVaultService };
//# sourceMappingURL=sin-vault.service.js.map