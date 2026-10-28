import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SIN_VAULT_MAX_CIPHERTEXT_BYTES, type PutSinVaultDto } from './dto/put-sin-vault.dto.js';

export interface SinVaultDto {
  ciphertext: string;
  iv: string;
  salt: string;
  kdf: string;
  iterations: number;
  version: number;
  updatedAt: string;
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const IV_BYTES = 12;
const SALT_BYTES = 16;

/** Decoded length of a canonical base64 string, or null when it is not one. */
export function base64Bytes(value: string): number | null {
  if (value.length === 0 || !BASE64.test(value)) return null;
  return Buffer.from(value, 'base64').length;
}

function invalid(message: string): BadRequestException {
  return new BadRequestException({ code: 'SIN_VAULT_INVALID', message });
}

/**
 * The encrypted sin program (contract §1, §3). The server never sees the sin or the notes: it stores
 * the AES-256-GCM ciphertext with its IV, salt and KDF settings, and keeps writes ordered with an
 * optimistic `version`. Nothing about the vault is logged.
 */
@Injectable()
export class SinVaultService {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: string): Promise<{ vault: SinVaultDto | null }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { sinVault: true } });
    if (!user) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' });
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

  /** Saves when `version` is the stored one (0 when there is none); otherwise 409 with the current vault. */
  async save(userId: string, dto: PutSinVaultDto): Promise<{ version: number }> {
    const ciphertextBytes = base64Bytes(dto.ciphertext);
    if (ciphertextBytes === null) throw invalid('ciphertext must be base64');
    if (ciphertextBytes > SIN_VAULT_MAX_CIPHERTEXT_BYTES) {
      throw new PayloadTooLargeException({
        code: 'SIN_VAULT_TOO_LARGE',
        message: `The vault ciphertext may be at most ${SIN_VAULT_MAX_CIPHERTEXT_BYTES} bytes`,
      });
    }
    if (base64Bytes(dto.iv) !== IV_BYTES) throw invalid(`iv must be ${IV_BYTES} bytes, base64`);
    if (base64Bytes(dto.salt) !== SALT_BYTES) throw invalid(`salt must be ${SALT_BYTES} bytes, base64`);

    const data = { ciphertext: dto.ciphertext, iv: dto.iv, salt: dto.salt, kdf: dto.kdf, iterations: dto.iterations };
    const version = dto.version + 1;
    if (dto.version === 0) {
      try {
        await this.prisma.sinVault.create({ data: { userId, ...data, version } });
        return { version };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw await this.conflict(userId);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
          throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' });
        }
        throw error;
      }
    }
    const { count } = await this.prisma.sinVault.updateMany({ where: { userId, version: dto.version }, data: { ...data, version } });
    if (count === 0) throw await this.conflict(userId);
    return { version };
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.sinVault.deleteMany({ where: { userId } });
  }

  private async conflict(userId: string): Promise<ConflictException> {
    const { vault } = await this.find(userId);
    return new ConflictException({
      code: 'SIN_VAULT_CONFLICT',
      message: 'The sin vault changed since it was read; open the current one, merge and retry',
      details: { vault },
    });
  }
}
