import { IsString, Matches } from 'class-validator';

/** PUT /circles/presence: the user's local date (YYYY-MM-DD); the service accepts only server today ±1 day. */
export class PresenceDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}
