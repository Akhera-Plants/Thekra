import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface CreateUserDto {
  email: string;
  passwordHash: string;
  displayName?: string;
}

/**
 * Thin service that owns User persistence.
 * No HTTP surface — used exclusively by AuthService.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(dto: CreateUserDto): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: dto.passwordHash,
        displayName: dto.displayName,
        // role defaults to USER per schema
      },
    });
  }

  /** Touch lastLoginAt without other updates — fast, no return needed. */
  touchLastLogin(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
