/**
 * Unit tests for @IsStrictInt() — the body-DTO numeric guard that rejects
 * string values that enableImplicitConversion would silently coerce to numbers.
 *
 * We use class-validator's validate() directly (not through the ValidationPipe)
 * so the transform step mirrors the real NestJS pipeline:
 *   plainToInstance (with enableImplicitConversion: true) → validate()
 */

import { plainToInstance } from 'class-transformer';
import { IsOptional, Max, Min, validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IsStrictInt } from './is-strict-int.decorator.js';

class StubDto {
  @IsOptional()
  @IsStrictInt()
  @Min(1)
  @Max(10)
  severity?: number;
}

async function validateDto(value: unknown) {
  const instance = plainToInstance(StubDto, { severity: value }, { enableImplicitConversion: true });
  return validate(instance);
}

describe('@IsStrictInt()', () => {
  it('accepts a proper integer', async () => {
    const errors = await validateDto(5);
    expect(errors).toHaveLength(0);
  });

  it('accepts the boundary values 1 and 10', async () => {
    expect(await validateDto(1)).toHaveLength(0);
    expect(await validateDto(10)).toHaveLength(0);
  });

  it('accepts undefined (field is optional)', async () => {
    const errors = await validateDto(undefined);
    expect(errors).toHaveLength(0);
  });

  it('rejects string "5" — even though implicit conversion would coerce it', async () => {
    const errors = await validateDto('5');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects string "0"', async () => {
    const errors = await validateDto('0');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a string that is not numeric', async () => {
    const errors = await validateDto('abc');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a float (not an integer)', async () => {
    const errors = await validateDto(5.5);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a value below @Min(1)', async () => {
    const errors = await validateDto(0);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a value above @Max(10)', async () => {
    const errors = await validateDto(11);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a boolean', async () => {
    const errors = await validateDto(true);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes null through (field is marked @IsOptional, clearing is allowed)', async () => {
    // @IsOptional() skips validation for null — protection against unwanted
    // null on non-nullable columns is the responsibility of @IsOptionalNotNull().
    const errors = await validateDto(null);
    expect(errors).toHaveLength(0);
  });
});
