import { PartialType } from '@nestjs/mapped-types';
import { CreateSourceDto } from './create-source.dto.js';

export class UpdateSourceDto extends PartialType(CreateSourceDto) {}
