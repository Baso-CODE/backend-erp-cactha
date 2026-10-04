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
} from "class-validator";

export class CreateProjectDTO {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  projectType!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID("4", {
    message: "Client ID tidak valid.",
  })
  clientId!: string;

  @IsUUID("4", {
    message: "Contract ID tidak valid.",
  })
  @IsOptional()
  contractId?: string;

  @IsUUID("4", {
    message: "Project Manager ID tidak valid.",
  })
  projectManagerId!: string;

  @Type(() => Date)
  @IsDate({
    message: "Start date tidak valid.",
  })
  startDate!: Date;

  @Type(() => Date)
  @IsDate({
    message: "Target end date tidak valid.",
  })
  targetEndDate!: Date;

  @IsEnum(ProjectStatus, {
    message: "Status project tidak valid.",
  })
  @IsOptional()
  status?: ProjectStatus;
}
