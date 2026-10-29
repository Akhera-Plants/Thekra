import { IsString, Matches, MaxLength } from 'class-validator';
import { CircleText } from './circle-text.decorator.js';
import { CIRCLE_DISPLAY_NAME_MAX } from './create-circle.dto.js';

/** POST /circles/join. The code may carry spaces, dashes or lower case; the service normalises it. */
export class JoinCircleDto {
  @IsString()
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9 -]+$/)
  code!: string;

  @CircleText(CIRCLE_DISPLAY_NAME_MAX)
  displayName!: string;
}
