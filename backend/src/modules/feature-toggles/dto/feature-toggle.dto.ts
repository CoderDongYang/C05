import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  IsObject,
  IsEnum,
} from 'class-validator';
import { Environment } from '../../../common/enums/role.enum';

export class CreateFeatureToggleDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  ownerId: number;

  @IsEnum(Environment)
  environment: Environment;

  @IsOptional()
  @IsBoolean()
  isGloballyEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whitelist?: string[];

  @IsOptional()
  @IsObject()
  attributeRules?: Record<string, unknown>;
}

export class UpdateFeatureToggleDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  ownerId?: number;

  @IsOptional()
  @IsBoolean()
  isGloballyEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whitelist?: string[];

  @IsOptional()
  @IsObject()
  attributeRules?: Record<string, unknown>;
}

export class QueryFeatureToggleDto {
  @IsOptional()
  @IsEnum(Environment)
  environment?: Environment;

  @IsOptional()
  @IsInt()
  ownerId?: number;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  pageSize?: number;
}

export class DebugPreviewDto {
  @IsEnum(Environment)
  environment: Environment;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  tags?: Record<string, unknown>;
}
