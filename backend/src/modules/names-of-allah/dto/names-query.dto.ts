import { IsIn, IsOptional } from 'class-validator';

export class NamesQueryDto {
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en' = 'ar';
}
