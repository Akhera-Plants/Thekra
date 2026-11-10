var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { HadithModule } from '../hadith/hadith.module.js';
import { QuotesModule } from '../quotes/quotes.module.js';
import { ImanBranchesAdminController } from './iman-branches.admin.controller.js';
import { ImanBranchesController } from './iman-branches.controller.js';
import { ImanBranchesService } from './iman-branches.service.js';
let ImanBranchesModule = class ImanBranchesModule {
};
ImanBranchesModule = __decorate([
    Module({
        imports: [QuotesModule, HadithModule, FavoritesModule, AuthModule],
        controllers: [ImanBranchesController, ImanBranchesAdminController],
        providers: [ImanBranchesService],
        exports: [ImanBranchesService],
    })
], ImanBranchesModule);
export { ImanBranchesModule };
//# sourceMappingURL=iman-branches.module.js.map