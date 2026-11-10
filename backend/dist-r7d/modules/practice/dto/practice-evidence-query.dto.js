var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { TransformToArray } from '../../../common/decorators/transform-to-array.decorator.js';
import { LocaleQueryDto } from '../../../common/dto/locale-query.dto.js';
export const MAX_EVIDENCE_IDS = 50;
export class PracticeEvidenceQueryDto extends LocaleQueryDto {
    ids;
}
__decorate([
    TransformToArray(),
    IsArray(),
    ArrayMinSize(1),
    ArrayMaxSize(MAX_EVIDENCE_IDS),
    IsUUID('all', { each: true }),
    __metadata("design:type", Array)
], PracticeEvidenceQueryDto.prototype, "ids", void 0);
//# sourceMappingURL=practice-evidence-query.dto.js.map