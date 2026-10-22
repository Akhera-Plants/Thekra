import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt } from 'class-validator';

/**
 * Use on **JSON body** DTO fields that must be integers.
 *
 * With `enableImplicitConversion: true` in the global ValidationPipe, class-
 * transformer silently coerces string `"5"` → number `5` for properties whose
 * TypeScript type is `number`, so bare `@IsInt()` accepts `{"severity":"5"}`.
 * A typed client sending a string instead of a number is a bug we should
 * surface as a 400, not silently accept.
 *
 * This decorator reads the **raw** (pre-coercion) value from `obj[key]` — the
 * same technique used by `@ToBoolean()` — and passes it straight to `@IsInt()`,
 * which then rejects non-integer values including strings.
 *
 * For **query** params, keep `@Type(() => Number) @IsInt()` instead: explicit
 * coercion is the correct behaviour for URL query strings, where every value
 * is inherently a string.
 *
 * Example:
 * ```ts
 * // Body DTO (POST / PATCH body)
 * @IsOptional()
 * @IsStrictInt()
 * @Min(1) @Max(10)
 * severity?: number;
 *
 * // Query DTO (GET /?severityMin=3)
 * @IsOptional()
 * @Type(() => Number) @IsInt()
 * @Min(1) @Max(10)
 * severityMin?: number;
 * ```
 */
export function IsStrictInt(): PropertyDecorator {
  return applyDecorators(
    // Read the original plain-object value before class-transformer's implicit
    // conversion so that a JSON string such as "5" is not silently accepted.
    Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => obj[key]),
    IsInt(),
  );
}
