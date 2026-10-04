import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import {
  flattenValidationErrors,
  validationExceptionFactory,
} from './validation-exception.factory.js';

describe('validationExceptionFactory', () => {
  it('flattens nested errors into { field, constraint, message }', () => {
    const errors: ValidationError[] = [
      {
        property: 'links',
        children: [
          {
            property: '0',
            children: [
              {
                property: 'quoteId',
                constraints: { isUuid: 'quoteId must be a UUID' },
                children: [],
              },
            ],
          },
        ],
      },
    ];
    expect(flattenValidationErrors(errors)).toEqual([
      {
        field: 'links.0.quoteId',
        constraint: 'isUuid',
        message: 'quoteId must be a UUID',
      },
    ]);
  });

  it('maps notMawdu to 422 GRADE_NOT_PERMITTED', () => {
    const err = validationExceptionFactory([
      {
        property: 'grades',
        constraints: { notMawdu: 'MAWDU grade is not permitted' },
        children: [],
      },
    ]);
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    expect(err.getResponse()).toMatchObject({
      code: 'GRADE_NOT_PERMITTED',
    });
  });

  it('maps other validation failures to 400 VALIDATION_FAILED', () => {
    const err = validationExceptionFactory([
      {
        property: 'relevanceScore',
        constraints: { max: 'must not exceed 100' },
        children: [],
      },
    ]);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [
        {
          field: 'relevanceScore',
          constraint: 'max',
          message: 'must not exceed 100',
        },
      ],
    });
  });
});
