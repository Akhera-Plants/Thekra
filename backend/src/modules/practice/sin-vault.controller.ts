import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PRIVATE_CACHE_HEADER } from '../../common/http/public-cache.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PutSinVaultDto } from './dto/put-sin-vault.dto.js';
import { SinVaultService } from './sin-vault.service.js';

/** The encrypted sin program of the signed-in user. Opaque to the server; never CDN-cached. */
@Controller('me/sin-vault')
@UseGuards(JwtAuthGuard)
export class SinVaultController {
  constructor(private readonly sinVault: SinVaultService) {}

  @Get()
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  find(@CurrentUser() user: JwtPayload) {
    return this.sinVault.find(user.sub);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  save(@CurrentUser() user: JwtPayload, @Body() dto: PutSinVaultDto) {
    return this.sinVault.save(user.sub, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', PRIVATE_CACHE_HEADER)
  async remove(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.sinVault.remove(user.sub);
  }
}
