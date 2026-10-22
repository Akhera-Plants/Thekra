import { Transform } from 'class-transformer';

/**
 * Parse query/body boolean flags correctly.
 * Reads the raw property from `obj` because `enableImplicitConversion` may
 * already have coerced the Transform `value` argument.
 *
 * `true` | `'true'` | `'1'` → true
 * `false` | `'false'` | `'0'` → false
 * `undefined` | `''` → undefined
 * anything else → left as-is so `@IsBoolean()` rejects with 400
 */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    if (raw === undefined || raw === '') {
      return undefined;
    }
    if (raw === true || raw === 'true' || raw === '1') {
      return true;
    }
    if (raw === false || raw === 'false' || raw === '0') {
      return false;
    }
    return raw;
  });
}
