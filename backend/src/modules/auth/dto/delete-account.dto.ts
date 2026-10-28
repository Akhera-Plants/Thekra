import { IsString, MaxLength, MinLength } from 'class-validator';

/** DELETE /auth/me: the password again, so a stolen access token cannot delete the account. */
export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
