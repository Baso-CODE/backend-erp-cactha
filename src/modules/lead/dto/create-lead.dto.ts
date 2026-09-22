// dto/create-lead.dto.ts

import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateLeadDTO {
  @IsString()
  @IsNotEmpty({ message: "Nama perusahaan wajib diisi" })
  company!: string;

  @IsString()
  @IsNotEmpty({ message: "PIC wajib diisi" })
  pic!: string;

  @IsString()
  @IsNotEmpty({ message: "Nomor telepon wajib diisi" })
  phone!: string;

  @IsEmail({}, { message: "Format email tidak valid" })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber({}, { message: "Estimated value harus berupa angka" })
  @Min(0, { message: "Estimated value tidak boleh negatif" })
  @IsOptional()
  estimatedValue?: number;

  @IsString()
  @IsOptional()
  source?: string;

  @IsUUID("4", { message: "Assignee ID tidak valid" })
  @IsNotEmpty({ message: "Sales assignee wajib dipilih" })
  assigneeId!: string;
}
