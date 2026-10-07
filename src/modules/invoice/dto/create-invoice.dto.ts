import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { CreateInvoiceItemDTO } from "./create-invoice-item.dto";

export class CreateInvoiceDTO {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsDateString()
  invoiceDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message:
      "Currency harus menggunakan kode ISO 3 huruf uppercase, contoh IDR.",
  })
  currency?: string;

  @IsOptional()
  @IsDecimal({
    decimal_digits: "0,2",
    force_decimal: false,
  })
  discountAmount?: string;

  @IsOptional()
  @IsDecimal({
    decimal_digits: "0,2",
    force_decimal: false,
  })
  taxAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, {
    message: "Invoice minimal memiliki 1 item.",
  })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDTO)
  items!: CreateInvoiceItemDTO[];
}
