import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateProposalDTO {
  @IsUUID("4", { message: "Lead ID tidak valid" })
  @IsNotEmpty({ message: "Lead wajib dipilih" })
  leadId!: string;

  @IsString()
  @IsNotEmpty({ message: "Subject proposal wajib diisi" })
  subject!: string;

  @IsNumber({}, { message: "Amount harus berupa angka" })
  @Min(0, { message: "Amount tidak boleh negatif" })
  amount!: number;

  @IsDateString({}, { message: "Proposal date tidak valid" })
  proposalDate!: string;

  @IsDateString({}, { message: "Valid until tidak valid" })
  validUntil!: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;
}
