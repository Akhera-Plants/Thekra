var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { QuotesAdminController } from './quotes.admin.controller.js';
import { QuotesController } from './quotes.controller.js';
import { QuoteReaderService } from './quote-reader.service.js';
import { QuoteReportsService } from './quote-reports.service.js';
import { QuotesService } from './quotes.service.js';
let QuotesModule = class QuotesModule {
};
QuotesModule = __decorate([
    Module({
        imports: [
            AuthModule,
            forwardRef(() => FavoritesModule),
        ],
        controllers: [QuotesController, QuotesAdminController],
        providers: [QuotesService, QuoteReportsService, QuoteReaderService],
        exports: [QuotesService],
    })
], QuotesModule);
export { QuotesModule };
//# sourceMappingURL=quotes.module.js.map