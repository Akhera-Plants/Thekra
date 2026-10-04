import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateTranslationDto {
  /**
   * BCP-47 language tag: two lowercase letters, optional region subtag.
   * "ar" is rejected — Arabic text lives in Quote.textAr.
   */
  @Matches(/^(?!ar$)[a-z]{2}(-[A-Z]{2})?$/, {
    message:
      'languageCode must match [a-z]{2}(-[A-Z]{2})? (e.g. "en", "en-US"); ' +
      '"ar" is reserved — Arabic text lives in textAr.',
  })
  languageCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  text!: string;
}
