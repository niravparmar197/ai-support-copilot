import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number;

  @IsString()
  @IsNotEmpty()
  SMTP_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string;

  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(
      `Config validation failed — check your .env against .env.example. Details: ${details}`,
    );
  }

  return validatedConfig;
}
