import { ProjectServiceStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export class QueryClientServiceDTO {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(ProjectServiceStatus)
  status?: ProjectServiceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @ValidateIf((_, value) => value !== undefined && value !== "uncategorized")
  @IsUUID("4", {
    message: "Service Category ID tidak valid.",
  })
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
