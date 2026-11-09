import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CircleText } from './circle-text.decorator.js';
import { CIRCLE_DISPLAY_NAME_MAX } from './create-circle.dto.js';

/**
 * POST /circles/invites/redeem. The code may carry spaces, dashes or lower case. `displayName` (the name shown in
 * the circle) is needed only when the invite also joins a circle; without it such an invite answers 400
 * CIRCLE_DISPLAY_NAME_REQUIRED and stays unused.
 */
export class RedeemCircleInviteDto {
  @IsString()
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9 -]+$/)
  code!: string;

  @IsOptional()
  @CircleText(CIRCLE_DISPLAY_NAME_MAX)
  displayName?: string;
}
