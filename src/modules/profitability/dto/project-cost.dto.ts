import { ProjectCostCategory } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateProjectCostDTO {
  @IsUUID("4")
  projectId!: string;

  @IsOptional()
  @IsUUID("4")
  projectServiceId?: string;

  @IsEnum(ProjectCostCategory)
  category!: ProjectCostCategory;

  @IsString()
  @MaxLength(255)
  description!: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/, {
    message: "Amount harus nominal positif dengan maksimal 2 desimal.",
  })
  amount!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @Type(() => Date)
  @IsDate()
  costDate!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProjectCostDTO {
  @IsOptional()
  @IsUUID("4")
  projectServiceId?: string;

  @IsOptional()
  @IsEnum(ProjectCostCategory)
  category?: ProjectCostCategory;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/, {
    message: "Amount harus nominal positif dengan maksimal 2 desimal.",
  })
  amount?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  costDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryProjectCostDTO {
  @IsOptional()
  @IsUUID("4")
  projectId?: string;

  @IsOptional()
  @IsUUID("4")
  projectServiceId?: string;

  @IsOptional()
  @IsEnum(ProjectCostCategory)
  category?: ProjectCostCategory;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

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
