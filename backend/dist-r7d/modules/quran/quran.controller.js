var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Controller, Get, Param, ParseIntPipe, Query, } from '@nestjs/common';
import { AyahDetailQueryDto } from './dto/ayah-detail-query.dto.js';
import { SurahAyahsQueryDto } from './dto/surah-ayahs-query.dto.js';
import { SurahsQueryDto } from './dto/surahs-query.dto.js';
import { QuranService } from './quran.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';
let QuranController = class QuranController {
    quranService;
    constructor(quranService) {
        this.quranService = quranService;
    }
    listSurahs(query) {
        return this.quranService.listSurahs(query);
    }
    findAyahsBySurah(surahNumber, query) {
        return this.quranService.findAyahsBySurah(surahNumber, query);
    }
    findAyah(surahNumber, ayahNumber, query) {
        return this.quranService.findAyah(surahNumber, ayahNumber, query);
    }
};
__decorate([
    Get('surahs'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SurahsQueryDto]),
    __metadata("design:returntype", void 0)
], QuranController.prototype, "listSurahs", null);
__decorate([
    Get('surahs/:surahNumber/ayahs'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Param('surahNumber', ParseIntPipe)),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, SurahAyahsQueryDto]),
    __metadata("design:returntype", void 0)
], QuranController.prototype, "findAyahsBySurah", null);
__decorate([
    Get('ayahs/:surahNumber/:ayahNumber'),
    PublicCache(PUBLIC_CACHE.content),
    __param(0, Param('surahNumber', ParseIntPipe)),
    __param(1, Param('ayahNumber', ParseIntPipe)),
    __param(2, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, AyahDetailQueryDto]),
    __metadata("design:returntype", void 0)
], QuranController.prototype, "findAyah", null);
QuranController = __decorate([
    Controller('quran'),
    __metadata("design:paramtypes", [QuranService])
], QuranController);
export { QuranController };
//# sourceMappingURL=quran.controller.js.map