var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsOptional } from 'class-validator';
import { CircleText } from './circle-text.decorator.js';
export const CIRCLE_NAME_MAX = 40;
export const CIRCLE_INTENTION_MAX = 120;
export const CIRCLE_DISPLAY_NAME_MAX = 30;
export class CreateCircleDto {
    name;
    intention;
    displayName;
}
__decorate([
    CircleText(CIRCLE_NAME_MAX),
    __metadata("design:type", String)
], CreateCircleDto.prototype, "name", void 0);
__decorate([
    IsOptional(),
    CircleText(CIRCLE_INTENTION_MAX),
    __metadata("design:type", String)
], CreateCircleDto.prototype, "intention", void 0);
__decorate([
    CircleText(CIRCLE_DISPLAY_NAME_MAX),
    __metadata("design:type", String)
], CreateCircleDto.prototype, "displayName", void 0);
//# sourceMappingURL=create-circle.dto.js.map