// update-user.dto.ts

import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
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

  @IsArray()
  @ArrayMinSize(1, { message: "Minimal satu role wajib dipilih" })
  @IsUUID("4", { each: true, message: "Role ID tidak valid" })
  @IsOptional()
  roleIds?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
