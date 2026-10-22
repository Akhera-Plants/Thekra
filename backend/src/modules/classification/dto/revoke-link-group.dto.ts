import { IsIn, IsUUID } from 'class-validator';

export class RevokeSinGroupDto {
  @IsUUID()
  sinId!: string;

  @IsIn(['REVIEWER', 'AI'])
  classifiedBy!: 'REVIEWER' | 'AI';
}

export class RevokeGoodDeedGroupDto {
  @IsUUID()
  goodDeedId!: string;

  @IsIn(['REVIEWER', 'AI'])
  classifiedBy!: 'REVIEWER' | 'AI';
}
