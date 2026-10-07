import { ClientStatus } from "@prisma/client";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateContactPersonDTO {
  @IsUUID("4", {
    message: "Client ID tidak valid.",
  })
  @IsOptional()
  clientId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  fullName?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  position?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  department?: string;

  @IsEmail(
    {},
    {
      message: "Format email tidak valid.",
    },
  )
  @IsOptional()
  email?: string;

  @IsString()
  @MaxLength(30)
  @IsOptional()
  phone?: string;

  @IsString()
  @MaxLength(30)
  @IsOptional()
  mobile?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsEnum(ClientStatus)
  @IsOptional()
  status?: ClientStatus;

  @IsOptional()
  @IsString()
  userId?: string;
}
