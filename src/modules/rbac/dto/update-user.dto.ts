import { Role } from "@prisma/client";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class UpdateUserDTO {
  @IsEmail({}, { message: "Format email tidak valid" })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(8, { message: "Password minimal 8 karakter" })
  @IsOptional()
  password?: string;

  @IsEnum(Role, { message: "Role tidak valid" })
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
