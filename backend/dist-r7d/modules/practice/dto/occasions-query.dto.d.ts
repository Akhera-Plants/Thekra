import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';
export declare const DATE_PATTERN: RegExp;
export declare class OccasionsQueryDto extends LocaleQueryDto {
    from?: string;
    to?: string;
    hijriOffset?: number;
}
