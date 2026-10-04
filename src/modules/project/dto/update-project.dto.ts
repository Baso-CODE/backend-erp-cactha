import { ProjectStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateProjectDTO {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  projectType?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID("4", {
    message: "Client ID tidak valid.",
  })
  @IsOptional()
  clientId?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID("4", {
    message: "Contract ID tidak valid.",
  })
  @IsOptional()
  contractId?: string | null;

  @IsUUID("4", {
    message: "Project Manager ID tidak valid.",
  })
  @IsOptional()
  projectManagerId?: string;

  @Type(() => Date)
  @IsDate({
    message: "Start date tidak valid.",
  })
  @IsOptional()
  startDate?: Date;

  @Type(() => Date)
  @IsDate({
    message: "Target end date tidak valid.",
  })
  @IsOptional()
  targetEndDate?: Date;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Type(() => Date)
  @IsDate({
    message: "Actual end date tidak valid.",
  })
  @IsOptional()
  actualEndDate?: Date | null;

  @IsEnum(ProjectStatus, {
    message: "Status project tidak valid.",
  })
  @IsOptional()
  status?: ProjectStatus;
}
