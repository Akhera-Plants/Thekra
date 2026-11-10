var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GoodDeedsAdminController } from './good-deeds.admin.controller.js';
import { GoodDeedsController } from './good-deeds.controller.js';
import { GoodDeedsService } from './good-deeds.service.js';
let GoodDeedsModule = class GoodDeedsModule {
};
GoodDeedsModule = __decorate([
    Module({
        imports: [QuotesModule, FavoritesModule, AuthModule],
        controllers: [GoodDeedsController, GoodDeedsAdminController],
        providers: [GoodDeedsService],
        exports: [GoodDeedsService],
    })
], GoodDeedsModule);
export { GoodDeedsModule };
//# sourceMappingURL=good-deeds.module.js.map