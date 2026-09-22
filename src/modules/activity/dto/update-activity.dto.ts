// dto/update-activity.dto.ts

import { ActivityStatus, ActivityType } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateActivityDTO {
  @IsEnum(ActivityType, { message: "Tipe activity tidak valid" })
  @IsOptional()
  type?: ActivityType;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  result?: string;

  @IsDateString({}, { message: "Activity date tidak valid" })
  @IsOptional()
  activityDate?: string;

  @IsDateString({}, { message: "Next follow up tidak valid" })
  @IsOptional()
  nextFollowUp?: string;

  @IsEnum(ActivityStatus, { message: "Status activity tidak valid" })
  @IsOptional()
  status?: ActivityStatus;
}
