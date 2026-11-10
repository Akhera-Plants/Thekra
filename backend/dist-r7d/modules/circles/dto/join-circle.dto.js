var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsString, Matches, MaxLength } from 'class-validator';
import { CircleText } from './circle-text.decorator.js';
import { CIRCLE_DISPLAY_NAME_MAX } from './create-circle.dto.js';
export class JoinCircleDto {
    code;
    displayName;
}
__decorate([
    IsString(),
    MaxLength(24),
    Matches(/^[A-Za-z0-9 -]+$/),
    __metadata("design:type", String)
], JoinCircleDto.prototype, "code", void 0);
__decorate([
    CircleText(CIRCLE_DISPLAY_NAME_MAX),
    __metadata("design:type", String)
], JoinCircleDto.prototype, "displayName", void 0);
//# sourceMappingURL=join-circle.dto.js.map