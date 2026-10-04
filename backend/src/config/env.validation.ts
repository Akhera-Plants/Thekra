import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
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
