import { IsOptional } from 'class-validator';
import { CircleText } from './circle-text.decorator.js';

export const CIRCLE_NAME_MAX = 40;
export const CIRCLE_INTENTION_MAX = 120;
export const CIRCLE_DISPLAY_NAME_MAX = 30;

/** POST /circles. `displayName` is the creator's name inside this circle (never the account email). */
export class CreateCircleDto {
  @CircleText(CIRCLE_NAME_MAX)
  name!: string;

  /** «نيّتنا», optional. */
  @IsOptional()
  @CircleText(CIRCLE_INTENTION_MAX)
  intention?: string;

  @CircleText(CIRCLE_DISPLAY_NAME_MAX)
  displayName!: string;
}
