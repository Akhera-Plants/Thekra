import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsOptional, validateSync } from 'class-validator';
import { ToBoolean } from './to-boolean.decorator.js';

class SampleDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  flag?: boolean;
}

function parse(raw: Record<string, unknown>) {
  const dto = plainToInstance(SampleDto, raw);
  const errors = validateSync(dto);
  return { dto, errors };
}

describe('ToBoolean', () => {
  it.each([
    [true, true],
    ['true', true],
    ['1', true],
    [false, false],
    ['false', false],
    ['0', false],
  ] as const)('maps %j → %s', (input, expected) => {
    const { dto, errors } = parse({ flag: input });
    expect(errors).toHaveLength(0);
    expect(dto.flag).toBe(expected);
  });

  it('maps undefined and empty string to undefined', () => {
    expect(parse({}).dto.flag).toBeUndefined();
    expect(parse({ flag: '' }).dto.flag).toBeUndefined();
  });

  it('leaves invalid values so @IsBoolean rejects them', () => {
    const { errors } = parse({ flag: 'yes' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
