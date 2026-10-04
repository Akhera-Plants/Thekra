import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Validates a :languageCode path parameter.
 * Accepts BCP-47 codes matching [a-z]{2}(-[A-Z]{2})? (e.g. "en", "en-US").
 * Rejects "ar" because Arabic text lives in Quote.textAr.
 */
const LC_RE = /^(?!ar$)[a-z]{2}(-[A-Z]{2})?$/;

@Injectable()
export class LanguageCodePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!LC_RE.test(value)) {
      throw new BadRequestException({
        code: 'INVALID_LANGUAGE_CODE',
        message:
          'languageCode must match [a-z]{2}(-[A-Z]{2})? (e.g. "en", "en-US"); ' +
          '"ar" is not allowed — Arabic text lives in textAr.',
      });
    }
    return value;
  }
}
