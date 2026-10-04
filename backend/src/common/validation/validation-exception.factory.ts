import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export interface ValidationDetail {
  field: string;
  constraint: string;
  message: string;
}

export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationDetail[] {
  const details: ValidationDetail[] = [];
  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    if (error.constraints) {
      for (const [constraint, message] of Object.entries(error.constraints)) {
        details.push({ field, constraint, message });
      }
    }
    if (error.children?.length) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }
  return details;
}

export function validationExceptionFactory(errors: ValidationError[]) {
  const details = flattenValidationErrors(errors);
  if (details.some((d) => d.constraint === 'notMawdu')) {
    return new UnprocessableEntityException({
      code: 'GRADE_NOT_PERMITTED',
      message: 'Fabricated (MAWDU) narrations are never served',
      details,
    });
  }
  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    details,
  });
}
