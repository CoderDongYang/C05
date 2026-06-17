import { IsString, IsNotEmpty, IsOptional, IsObject, IsEnum } from 'class-validator';
import { Environment } from '../../../common/enums/role.enum';

export class GetConfigDto {
  @IsEnum(Environment)
  @IsNotEmpty()
  env: Environment;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  tags?: Record<string, unknown>;
}
