import { IsDecimal, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateInvoiceItemDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsDecimal({
    decimal_digits: "0,2",
    force_decimal: false,
  })
  quantity!: string;

  @IsDecimal({
    decimal_digits: "0,2",
    force_decimal: false,
  })
  unitPrice!: string;
}
