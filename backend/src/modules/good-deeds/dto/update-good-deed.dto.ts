import { PartialType } from '@nestjs/mapped-types';
import { CreateGoodDeedDto } from './create-good-deed.dto.js';

export class UpdateGoodDeedDto extends PartialType(CreateGoodDeedDto) {}
