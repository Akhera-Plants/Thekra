import { Transform } from 'class-transformer';
export function ToBoolean() {
    return Transform(({ obj, key }) => {
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
//# sourceMappingURL=to-boolean.decorator.js.map