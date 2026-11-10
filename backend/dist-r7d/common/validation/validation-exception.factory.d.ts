import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
export interface ValidationDetail {
    field: string;
    constraint: string;
    message: string;
}
export declare function flattenValidationErrors(errors: ValidationError[], parentPath?: string): ValidationDetail[];
export declare function validationExceptionFactory(errors: ValidationError[]): BadRequestException | UnprocessableEntityException;
