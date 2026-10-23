import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { AyahDetailQueryDto } from './dto/ayah-detail-query.dto.js';
import { SurahAyahsQueryDto } from './dto/surah-ayahs-query.dto.js';
import { SurahsQueryDto } from './dto/surahs-query.dto.js';
import { QuranService } from './quran.service.js';
import { PUBLIC_CACHE, PublicCache } from '../../common/http/public-cache.js';

@Controller('quran')
export class QuranController {
  constructor(private readonly quranService: QuranService) {}

  @Get('surahs')
  @PublicCache(PUBLIC_CACHE.content)
  listSurahs(@Query() query: SurahsQueryDto) {
    return this.quranService.listSurahs(query);
  }

  @Get('surahs/:surahNumber/ayahs')
  @PublicCache(PUBLIC_CACHE.content)
  findAyahsBySurah(
    @Param('surahNumber', ParseIntPipe) surahNumber: number,
    @Query() query: SurahAyahsQueryDto,
  ) {
    return this.quranService.findAyahsBySurah(surahNumber, query);
  }

  @Get('ayahs/:surahNumber/:ayahNumber')
  @PublicCache(PUBLIC_CACHE.content)
  findAyah(
    @Param('surahNumber', ParseIntPipe) surahNumber: number,
    @Param('ayahNumber', ParseIntPipe) ayahNumber: number,
    @Query() query: AyahDetailQueryDto,
  ) {
    return this.quranService.findAyah(surahNumber, ayahNumber, query);
  }
}
