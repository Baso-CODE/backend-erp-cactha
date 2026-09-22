// dto/update-lead.dto.ts

import { LeadStatus } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class UpdateLeadDTO {
  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  pic?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail({}, { message: "Format email tidak valid" })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber({}, { message: "Estimated value harus berupa angka" })
  @Min(0, { message: "Estimated value tidak boleh negatif" })
  @IsOptional()
  estimatedValue?: number;

  @IsString()
  @IsOptional()
  source?: string;

  @IsEnum(LeadStatus, { message: "Status lead tidak valid" })
  @IsOptional()
  status?: LeadStatus;

  @IsUUID("4", { message: "Assignee ID tidak valid" })
  @IsOptional()
  assigneeId?: string;
}
