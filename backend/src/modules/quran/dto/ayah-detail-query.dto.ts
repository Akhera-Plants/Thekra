import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';

export class AyahDetailQueryDto extends LocaleQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeAllTranslations?: boolean = false;
}
