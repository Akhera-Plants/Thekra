import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';
export declare const MAX_EVIDENCE_IDS = 50;
export declare class PracticeEvidenceQueryDto extends LocaleQueryDto {
    ids: string[];
}
