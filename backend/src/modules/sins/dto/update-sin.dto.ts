import { PartialType } from '@nestjs/mapped-types';
import { CreateSinDto } from './create-sin.dto.js';

export class UpdateSinDto extends PartialType(CreateSinDto) {}
