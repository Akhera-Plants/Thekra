import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Control characters and bidi overrides/isolates are refused: other members see these strings, and an
 * override could make a name read as something else.
 */
const SAFE_TEXT = /^[^\p{Cc}‪-‮⁦-⁩]+$/u;

/** A trimmed, non-empty line of text shown to the other members of a circle, at most `max` characters. */
export function CircleText(max: number): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    MinLength(1),
    MaxLength(max),
    Matches(SAFE_TEXT, { message: 'must not contain control or direction-override characters' }),
  );
}
