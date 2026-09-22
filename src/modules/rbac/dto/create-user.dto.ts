// create-user.dto.ts

import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreateUserDTO {
  @IsEmail({}, { message: "Format email tidak valid" })
  @IsNotEmpty({ message: "Email wajib diisi" })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: "Nama wajib diisi" })
  name!: string;

  @IsString()
  @MinLength(8, { message: "Password minimal 8 karakter" })
  @IsNotEmpty({ message: "Password wajib diisi" })
  password!: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Minimal satu role wajib dipilih" })
  @IsUUID("4", { each: true, message: "Role ID tidak valid" })
  roleIds!: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
