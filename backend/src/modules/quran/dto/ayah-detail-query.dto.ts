import { IsBoolean, IsOptional } from 'class-validator';
import { ToBoolean } from '../../../common/decorators/to-boolean.decorator.js';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';

export class AyahDetailQueryDto extends LocaleQueryDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeAllTranslations?: boolean = false;
}
