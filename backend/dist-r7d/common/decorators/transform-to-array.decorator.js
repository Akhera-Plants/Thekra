import { Transform } from 'class-transformer';
export function TransformToArray() {
    return Transform(({ value }) => {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }
        if (Array.isArray(value)) {
            return value.flatMap((item) => typeof item === 'string' ? item.split(',') : [item]);
        }
        if (typeof value === 'string') {
            return value.split(',').map((part) => part.trim()).filter(Boolean);
        }
        return [value];
    });
}
//# sourceMappingURL=transform-to-array.decorator.js.map