var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module.js';
import { QuranController } from './quran.controller.js';
import { QuranService } from './quran.service.js';
let QuranModule = class QuranModule {
};
QuranModule = __decorate([
    Module({
        imports: [QuotesModule],
        controllers: [QuranController],
        providers: [QuranService],
        exports: [QuranService],
    })
], QuranModule);
export { QuranModule };
//# sourceMappingURL=quran.module.js.map