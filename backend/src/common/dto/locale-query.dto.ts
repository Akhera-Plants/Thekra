import { IsIn, IsOptional } from 'class-validator';

export type AppLocale = 'ar' | 'en';

export class LocaleQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: AppLocale = 'ar';
}
