import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
const SAFE_TEXT = /^[^\p{Cc}‪-‮⁦-⁩]+$/u;
export function CircleText(max) {
    return applyDecorators(Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)), IsString(), MinLength(1), MaxLength(max), Matches(SAFE_TEXT, { message: 'must not contain control or direction-override characters' }));
}
//# sourceMappingURL=circle-text.decorator.js.map