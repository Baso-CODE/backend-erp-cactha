// dto/query-activity.dto.ts

import { ActivityStatus, ActivityType } from "@prisma/client";
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

export class QueryActivityDTO {
  @IsUUID("4", { message: "Lead ID tidak valid" })
  @IsOptional()
  leadId?: string;

  @IsEnum(ActivityType, { message: "Tipe activity tidak valid" })
  @IsOptional()
  type?: ActivityType;

  @IsEnum(ActivityStatus, { message: "Status activity tidak valid" })
  @IsOptional()
  status?: ActivityStatus;

  @IsUUID("4", { message: "Performed By ID tidak valid" })
  @IsOptional()
  performedById?: string;

  @IsString()
  @IsOptional()
  search?: string;

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
