var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BranchQuotesAdminController } from './branch-quotes.admin.controller.js';
import { ChapterMapsAdminController } from './chapter-maps.admin.controller.js';
import { ChapterMapsService } from './chapter-maps.service.js';
import { GoodDeedQuotesAdminController, SinQuotesAdminController, } from './classification.admin.controller.js';
import { ClassificationService } from './classification.service.js';
import { LinkConcernsAdminController } from './link-concerns.admin.controller.js';
let ClassificationModule = class ClassificationModule {
};
ClassificationModule = __decorate([
    Module({
        imports: [AuthModule],
        controllers: [
            SinQuotesAdminController,
            GoodDeedQuotesAdminController,
            BranchQuotesAdminController,
            ChapterMapsAdminController,
            LinkConcernsAdminController,
        ],
        providers: [ClassificationService, ChapterMapsService],
        exports: [ClassificationService],
    })
], ClassificationModule);
export { ClassificationModule };
//# sourceMappingURL=classification.module.js.map