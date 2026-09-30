import { ContractStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateContractDTO {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsUUID("4", {
    message: "Client ID tidak valid.",
  })
  @IsOptional()
  clientId?: string;

  @IsUUID("4", {
    message: "Quotation ID tidak valid.",
  })
  @IsOptional()
  quotationId?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  contractType?: string;

  @Type(() => Date)
  @IsDate({
    message: "Start date tidak valid.",
  })
  @IsOptional()
  startDate?: Date;

  @Type(() => Date)
  @IsDate({
    message: "End date tidak valid.",
  })
  @IsOptional()
  endDate?: Date;

  @Type(() => Number)
  @IsNumber(
    {
      maxDecimalPlaces: 2,
    },
    {
      message: "Nilai contract harus berupa angka.",
    },
  )
  @Min(0)
  @IsOptional()
  value?: number;

  @IsString()
  @MaxLength(10)
  @IsOptional()
  currency?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  paymentTerm?: string;

  @IsString()
  @IsOptional()
  slaTerms?: string;

  @IsString()
  @IsOptional()
  termsConditions?: string;

  @IsUrl(
    {
      require_protocol: true,
    },
    {
      message: "Document URL tidak valid.",
    },
  )
  @IsOptional()
  documentUrl?: string;

  @IsEnum(ContractStatus)
  @IsOptional()
  status?: ContractStatus;

  @IsBoolean()
  @IsOptional()
  renewalReminder?: boolean;
}
