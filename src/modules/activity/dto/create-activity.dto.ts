// dto/create-activity.dto.ts

import { ActivityStatus, ActivityType } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateActivityDTO {
  @IsUUID("4", { message: "Lead ID tidak valid" })
  @IsNotEmpty({ message: "Lead wajib dipilih" })
  leadId!: string;

  @IsEnum(ActivityType, { message: "Tipe activity tidak valid" })
  @IsNotEmpty({ message: "Tipe activity wajib dipilih" })
  type!: ActivityType;

  @IsString()
  @IsNotEmpty({ message: "Subject wajib diisi" })
  subject!: string;

  @IsString()
  @IsNotEmpty({ message: "Description wajib diisi" })
  description!: string;

  @IsString()
  @IsOptional()
  result?: string;

  @IsDateString({}, { message: "Activity date tidak valid" })
  @IsNotEmpty({ message: "Activity date wajib diisi" })
  activityDate!: string;

  @IsDateString({}, { message: "Next follow up tidak valid" })
  @IsOptional()
  nextFollowUp?: string;

  @IsEnum(ActivityStatus, { message: "Status activity tidak valid" })
  @IsOptional()
  status?: ActivityStatus;
}
