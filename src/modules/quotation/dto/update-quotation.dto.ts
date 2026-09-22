// dto/update-quotation.dto.ts

import { QuotationStatus } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, Min } from "class-validator";

export class UpdateQuotationDTO {
  @IsNumber({}, { message: "Amount harus berupa angka" })
  @Min(0, { message: "Amount tidak boleh negatif" })
  @IsOptional()
  amount?: number;

  @IsEnum(QuotationStatus, { message: "Status quotation tidak valid" })
  @IsOptional()
  status?: QuotationStatus;
}
