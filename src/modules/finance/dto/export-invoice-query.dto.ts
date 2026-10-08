import { InvoiceStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, Matches } from "class-validator";

export class ExportInvoiceQueryDTO {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;
}
