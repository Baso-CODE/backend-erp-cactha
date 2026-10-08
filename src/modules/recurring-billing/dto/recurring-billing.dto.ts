import { RecurringBillingFrequency } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateRecurringBillingDTO {
  @IsUUID("4")
  contractId!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsEnum(RecurringBillingFrequency)
  frequency!: RecurringBillingFrequency;

  @Type(() => Date)
  @IsDate()
  nextRunDate!: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  dueDays?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRecurringBillingDTO {
  @IsOptional()
  @IsNumberString()
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsEnum(RecurringBillingFrequency)
  frequency?: RecurringBillingFrequency;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextRunDate?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  dueDays?: number;
}

export class QueryRecurringBillingDTO {
  @IsOptional()
  @IsUUID("4")
  contractId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(RecurringBillingFrequency)
  frequency?: RecurringBillingFrequency;

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
