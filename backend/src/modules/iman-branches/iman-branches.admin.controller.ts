import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard, Roles, RolesGuard } from '../../common/guards/admin.guard.js';
import { setCreated } from '../../common/http/set-created.js';
import { CreateImanBranchDto } from './dto/create-iman-branch.dto.js';
import { ReplaceBranchPracticesDto } from './dto/replace-practices.dto.js';
import { UpdateImanBranchDto } from './dto/update-iman-branch.dto.js';
import { ImanBranchesService } from './iman-branches.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/branches')
export class ImanBranchesAdminController {
  constructor(private readonly branches: ImanBranchesService) {}

  @Post()
  async create(
    @Body() dto: CreateImanBranchDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const branch = await this.branches.adminCreate(dto);
    setCreated(res, `/v1/admin/branches/${branch.id}`);
    return { data: branch };
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImanBranchDto,
  ) {
    return this.branches.adminUpdate(id, dto).then((data) => ({ data }));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branches.adminDelete(id);
  }

  @Put(':id/practices')
  replacePractices(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceBranchPracticesDto,
  ) {
    return this.branches.replacePractices(id, dto);
  }
}
