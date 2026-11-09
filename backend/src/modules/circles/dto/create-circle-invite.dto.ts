import { IsOptional, IsUUID } from 'class-validator';

/** POST /circles/invites. With `circleId` (owner only) redeeming also joins that circle. */
export class CreateCircleInviteDto {
  @IsOptional()
  @IsUUID()
  circleId?: string;
}
