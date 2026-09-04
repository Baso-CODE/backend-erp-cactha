import { Role } from "@prisma/client";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
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

  @IsEnum(Role, { message: "Role tidak valid" })
  @IsNotEmpty({ message: "Role wajib diisi" })
  role!: Role;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
