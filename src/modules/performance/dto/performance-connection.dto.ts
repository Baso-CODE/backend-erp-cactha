import { PerformancePlatform } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class QueryPerformanceConnectionDTO {
  @IsOptional()
  @IsEnum(PerformancePlatform)
  platform?: PerformancePlatform;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}

export class CreatePerformanceConnectionDTO {
  @IsEnum(PerformancePlatform)
  platform!: PerformancePlatform;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class UpdatePerformanceConnectionDTO {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;
}

export class PerformanceConnectionIdDTO {
  @IsUUID("4")
  id!: string;
}
