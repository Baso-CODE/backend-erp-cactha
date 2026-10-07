import { PaymentMethod } from "@prisma/client";
import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreatePaymentDTO {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsDecimal({
    decimal_digits: "0,2",
    force_decimal: false,
  })
  amountPaid!: string;

  @IsDateString()
  paymentDate!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  proofUrl?: string;
}
