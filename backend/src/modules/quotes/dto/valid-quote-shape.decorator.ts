/**
 * P2-4: Class-level cross-field shape validator for Quote DTOs.
 *
 * Rules:
 *   - HADITH requires a non-null `grade`
 *   - QURAN_VERSE requires a non-null `surahNumber`
 *
 * The pure `checkQuoteShape()` function is also exported so the service layer
 * can reuse it when validating a merged (existing + patch) record in adminUpdate.
 *
 * Throws validation errors → 400 VALIDATION_FAILED (via ValidationPipe /
 * validationExceptionFactory), NOT 422.
 */

import { QuoteType, type HadithGrade } from '@prisma/client';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

/** Minimal shape of any object that can be cross-field validated. */
export interface QuoteShapeInput {
  type?: QuoteType;
  grade?: HadithGrade | null;
  surahNumber?: number | null;
}

/**
 * Pure shape-check function reusable outside the decorator
 * (e.g. in `adminUpdate` after merging the PATCH body onto the existing row).
 *
 * @returns A human-readable error message, or `null` when the shape is valid.
 */
export function checkQuoteShape(shape: QuoteShapeInput): string | null {
  if (shape.type === QuoteType.HADITH && shape.grade == null) {
    return 'grade is required when type is HADITH (use UNGRADED if unknown)';
  }
  if (shape.type === QuoteType.QURAN_VERSE && shape.surahNumber == null) {
    return 'surahNumber is required when type is QURAN_VERSE';
  }
  return null;
}

/** class-validator constraint that delegates to `checkQuoteShape`. */
@ValidatorConstraint({ name: 'validQuoteShape', async: false })
export class ValidQuoteShapeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return checkQuoteShape(args.object as QuoteShapeInput) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    return checkQuoteShape(args.object as QuoteShapeInput) ?? 'Quote shape is invalid';
  }
}

/**
 * Class-level decorator — apply to a CreateQuoteDto (or any class that carries
 * both `type` and the kind-specific fields).
 *
 * The constraint is registered on the `type` property so that class-validator
 * runs it during the standard per-property metadata walk; `args.object` gives
 * access to the whole DTO for cross-field checks.
 *
 * @example
 * ```ts
 * \@ValidQuoteShape()
 * export class CreateQuoteDto { ... }
 * ```
 */
export function ValidQuoteShape(): ClassDecorator {
  // ClassDecorator signature: (target: Function) => void | Function
  // registerDecorator expects target: Function — pass it directly.
  return (target) => {
    registerDecorator({
      name: 'validQuoteShape',
      target,
      propertyName: 'type',
      constraints: [],
      options: {},
      validator: ValidQuoteShapeConstraint,
    });
  };
}
