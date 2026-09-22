// dto/query-quotation.dto.ts

import { QuotationStatus } from "@prisma/client";
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

export class QueryQuotationDTO {
  @IsUUID("4", { message: "Lead ID tidak valid" })
  @IsOptional()
  leadId?: string;

  @IsEnum(QuotationStatus, { message: "Status quotation tidak valid" })
  @IsOptional()
  status?: QuotationStatus;

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
