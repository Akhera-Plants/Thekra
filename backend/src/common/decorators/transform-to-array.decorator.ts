import { Transform } from 'class-transformer';

/** Accepts `?type=A&type=B` or `?type=A,B` as a string array. */
export function TransformToArray(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) =>
        typeof item === 'string' ? item.split(',') : [item],
      );
    }
    if (typeof value === 'string') {
      return value.split(',').map((part) => part.trim()).filter(Boolean);
    }
    return [value];
  });
}
