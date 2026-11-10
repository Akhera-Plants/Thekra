import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt } from 'class-validator';
export function IsStrictInt() {
    return applyDecorators(Transform(({ obj, key }) => obj[key]), IsInt());
}
//# sourceMappingURL=is-strict-int.decorator.js.map