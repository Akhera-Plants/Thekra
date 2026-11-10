var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { QuoteType } from '@prisma/client';
import { ValidatorConstraint, registerDecorator, } from 'class-validator';
export function checkQuoteShape(shape) {
    if (shape.type === QuoteType.HADITH && shape.grade == null) {
        return 'grade is required when type is HADITH (use UNGRADED if unknown)';
    }
    if (shape.type === QuoteType.QURAN_VERSE && shape.surahNumber == null) {
        return 'surahNumber is required when type is QURAN_VERSE';
    }
    return null;
}
let ValidQuoteShapeConstraint = class ValidQuoteShapeConstraint {
    validate(_value, args) {
        return checkQuoteShape(args.object) === null;
    }
    defaultMessage(args) {
        return checkQuoteShape(args.object) ?? 'Quote shape is invalid';
    }
};
ValidQuoteShapeConstraint = __decorate([
    ValidatorConstraint({ name: 'validQuoteShape', async: false })
], ValidQuoteShapeConstraint);
export { ValidQuoteShapeConstraint };
export function ValidQuoteShape() {
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
//# sourceMappingURL=valid-quote-shape.decorator.js.map