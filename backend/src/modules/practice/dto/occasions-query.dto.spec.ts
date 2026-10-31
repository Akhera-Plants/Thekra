/**
 * The web and mobile api-clients add `?lang=` to every public GET. With the global
 * `forbidNonWhitelisted` pipe, a DTO that does not declare `lang` answers 400 to every real client.
 */

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { OccasionsQueryDto } from './occasions-query.dto.js';

async function errorsFor(query: Record<string, string>) {
  const instance = plainToInstance(OccasionsQueryDto, query, { enableImplicitConversion: true });
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('OccasionsQueryDto', () => {
  it('accepts the lang that the clients add', async () => {
    expect(await errorsFor({ from: '2027-05-10', to: '2027-05-20', hijriOffset: '-1', lang: 'ar' })).toHaveLength(0);
    expect(await errorsFor({ lang: 'en' })).toHaveLength(0);
  });

  it('still rejects an unknown lang and unknown keys', async () => {
    expect(await errorsFor({ lang: 'fr' })).not.toHaveLength(0);
    expect(await errorsFor({ foo: '1' })).not.toHaveLength(0);
  });
});
