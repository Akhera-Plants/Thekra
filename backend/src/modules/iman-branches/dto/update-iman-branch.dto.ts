import { PartialType } from '@nestjs/mapped-types';
import { CreateImanBranchDto } from './create-iman-branch.dto.js';

export class UpdateImanBranchDto extends PartialType(CreateImanBranchDto) {}
