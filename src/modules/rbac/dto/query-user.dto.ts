import { Role } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class QueryUserDTO {
  @IsEnum(Role, { message: "Role tidak valid" })
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  isActive?: boolean;

  @IsString()
  @IsOptional()
  search?: string; // Pencarian berdasarkan nama atau email

  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 10;
}
