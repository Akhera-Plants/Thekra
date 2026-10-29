import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SendCheerDto } from './send-cheer.dto.js';

async function errorsFor(body: Record<string, unknown>) {
  return validate(plainToInstance(SendCheerDto, body), { whitelist: true, forbidNonWhitelisted: true });
}

describe('SendCheerDto', () => {
  it('accepts every preset, «ادعُ لي» (ask_dua) included', async () => {
    for (const message of ['thabat', 'jazak', 'dhakkarani', 'ask_dua']) expect(await errorsFor({ message })).toHaveLength(0);
  });

  it('refuses free text and extra fields', async () => {
    expect(await errorsFor({ message: 'ادعُ لي أترك …' })).not.toHaveLength(0);
    expect(await errorsFor({ message: 'ask_dua', note: 'x' })).not.toHaveLength(0);
  });
});
