// dto/query-lead.dto.ts

import { LeadStatus } from "@prisma/client";
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

export class QueryLeadDTO {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(LeadStatus, { message: "Status lead tidak valid" })
  @IsOptional()
  status?: LeadStatus;

  @IsUUID("4", { message: "Assignee ID tidak valid" })
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  industry?: string;

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
