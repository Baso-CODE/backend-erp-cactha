// dto/create-quotation.dto.ts

import { IsNotEmpty, IsNumber, IsUUID, Min } from "class-validator";

export class CreateQuotationDTO {
  @IsUUID("4", { message: "Lead ID tidak valid" })
  @IsNotEmpty({ message: "Lead wajib dipilih" })
  leadId!: string;

  @IsNumber({}, { message: "Amount harus berupa angka" })
  @Min(0, { message: "Amount tidak boleh negatif" })
  amount!: number;
}
