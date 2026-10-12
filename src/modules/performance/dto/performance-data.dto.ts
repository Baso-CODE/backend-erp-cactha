import { PerformancePlatform } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class QueryPerformanceDataDTO {
  @IsOptional() @IsUUID("4") accountId?: string;
  @IsOptional() @IsUUID("4") clientId?: string;
  @IsOptional() @IsUUID("4") projectId?: string;
  @IsOptional() @IsEnum(PerformancePlatform) platform?: PerformancePlatform;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
