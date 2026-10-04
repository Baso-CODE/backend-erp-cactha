import { ProjectStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryProjectDTO {
  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID("4", {
    message: "Client ID tidak valid.",
  })
  @IsOptional()
  clientId?: string;

  @IsUUID("4", {
    message: "Contract ID tidak valid.",
  })
  @IsOptional()
  contractId?: string;

  @IsUUID("4", {
    message: "Project Manager ID tidak valid.",
  })
  @IsOptional()
  projectManagerId?: string;

  @IsEnum(ProjectStatus, {
    message: "Status project tidak valid.",
  })
  @IsOptional()
  status?: ProjectStatus;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 10;
}
