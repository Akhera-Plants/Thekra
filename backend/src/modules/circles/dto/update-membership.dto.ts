import { IsBoolean, IsOptional } from 'class-validator';
import { CircleText } from './circle-text.decorator.js';
import { CIRCLE_DISPLAY_NAME_MAX } from './create-circle.dto.js';

/** PATCH /circles/:id/membership: my name in this circle and whether I share «حضرت اليوم». */
export class UpdateMembershipDto {
  @IsOptional()
  @CircleText(CIRCLE_DISPLAY_NAME_MAX)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  sharesPresence?: boolean;
}
