import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { exportForSync, parseStore, STORE_VERSION, type SyncPayload } from '@thekra/practice-core';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PutPracticeStoreDto } from './dto/put-practice-store.dto.js';
import type { PracticeStoreDto } from './entities/practice.entity.js';

/** Largest store (UTF-8 JSON) one account may sync. The JSON body limit in configure-app.ts leaves room for it. */
export const PRACTICE_STORE_MAX_BYTES = 256 * 1024;

/**
 * True when any object in the JSON has a `programs` key. Sin-program data is
 * local only (roadmap §0.1): a client that sends it has a bug, so the request
 * is refused instead of silently dropping the key. Iterative, so a deeply
 * nested body cannot overflow the stack.
 */
export function containsProgramsKey(value: unknown): boolean {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) pending.push(...current);
    else if (typeof current === 'object' && current !== null) {
      if (Object.hasOwn(current, 'programs')) return true;
      pending.push(...Object.values(current));
    }
  }
  return false;
}

function userNotFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'User not found' });
}

/**
 * The account copy of a user's practice store (plans, kinship list, settings;
 * never sin programs). Writes use optimistic concurrency on `version`.
 * The store's content is personal: it is never logged.
 */
@Injectable()
export class PracticeStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: string): Promise<PracticeStoreDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { practiceStore: { select: { data: true, version: true } } },
    });
    if (!user) throw userNotFound();
    if (!user.practiceStore) return { store: null, version: 0 };
    return { store: user.practiceStore.data as unknown as SyncPayload, version: user.practiceStore.version };
  }

  /** Saves the store when `version` is the stored one; otherwise 409 with the current store. */
  async save(userId: string, dto: PutPracticeStoreDto): Promise<{ version: number }> {
    if (containsProgramsKey(dto.store)) {
      throw new BadRequestException({
        code: 'PRACTICE_PROGRAMS_NOT_ALLOWED',
        message: 'Sin-program data stays on the device and is never synced',
      });
    }
    if (Buffer.byteLength(JSON.stringify(dto.store), 'utf8') > PRACTICE_STORE_MAX_BYTES) {
      throw new PayloadTooLargeException({
        code: 'PRACTICE_STORE_TOO_LARGE',
        message: `The practice store may be at most ${PRACTICE_STORE_MAX_BYTES} bytes`,
      });
    }
    if (dto.store['v'] !== STORE_VERSION) {
      throw new BadRequestException({
        code: 'PRACTICE_STORE_INVALID',
        message: `store.v must be ${STORE_VERSION}`,
      });
    }
    const data = JSON.parse(JSON.stringify(exportForSync(parseStore(dto.store)))) as Prisma.InputJsonObject;
    const version = dto.version + 1;

    if (dto.version === 0) {
      try {
        await this.prisma.userPracticeStore.create({ data: { userId, data, version } });
        return { version };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw await this.conflict(userId);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw userNotFound();
        throw error;
      }
    }
    const { count } = await this.prisma.userPracticeStore.updateMany({
      where: { userId, version: dto.version },
      data: { data, version },
    });
    if (count === 0) throw await this.conflict(userId);
    return { version };
  }

  private async conflict(userId: string): Promise<ConflictException> {
    const current = await this.find(userId);
    return new ConflictException({
      code: 'PRACTICE_VERSION_CONFLICT',
      message: 'The practice store changed since it was read; merge with the current one and retry',
      details: current,
    });
  }
}
