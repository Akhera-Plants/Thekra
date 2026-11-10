import { ValidateIf } from 'class-validator';
export const IsOptionalNotNull = () => ValidateIf((_, v) => v !== undefined);
//# sourceMappingURL=is-optional-not-null.decorator.js.map