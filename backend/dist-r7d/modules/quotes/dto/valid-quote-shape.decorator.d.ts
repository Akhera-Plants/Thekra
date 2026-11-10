import { QuoteType, type HadithGrade } from '@prisma/client';
import { ValidationArguments, ValidatorConstraintInterface } from 'class-validator';
export interface QuoteShapeInput {
    type?: QuoteType;
    grade?: HadithGrade | null;
    surahNumber?: number | null;
}
export declare function checkQuoteShape(shape: QuoteShapeInput): string | null;
export declare class ValidQuoteShapeConstraint implements ValidatorConstraintInterface {
    validate(_value: unknown, args: ValidationArguments): boolean;
    defaultMessage(args: ValidationArguments): string;
}
export declare function ValidQuoteShape(): ClassDecorator;
