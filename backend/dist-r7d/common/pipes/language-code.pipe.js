var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { BadRequestException, Injectable } from '@nestjs/common';
const LC_RE = /^(?!ar$)[a-z]{2}(-[A-Z]{2})?$/;
let LanguageCodePipe = class LanguageCodePipe {
    transform(value) {
        if (!LC_RE.test(value)) {
            throw new BadRequestException({
                code: 'INVALID_LANGUAGE_CODE',
                message: 'languageCode must match [a-z]{2}(-[A-Z]{2})? (e.g. "en", "en-US"); ' +
                    '"ar" is not allowed — Arabic text lives in textAr.',
            });
        }
        return value;
    }
};
LanguageCodePipe = __decorate([
    Injectable()
], LanguageCodePipe);
export { LanguageCodePipe };
//# sourceMappingURL=language-code.pipe.js.map