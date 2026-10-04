import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number = 3001;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string = 'http://localhost:3000';

  @IsOptional()
  @IsString()
  NODE_ENV?: string = 'development';

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string = 'info';

  /**
   * Minimum relevanceScore for a link to be placed in the shuffled "variety band".
   * Links with score >= this threshold are ordered by md5(link.id + seed); links
   * below the threshold follow in the normal LINK_ORDER. See backend-plan §4.2.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  VARIETY_SCORE_FLOOR?: number = 70;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment: ${messages}`);
  }
  return validated;
}
