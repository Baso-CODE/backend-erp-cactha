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

export class CreateContactPersonDTO {
  @IsUUID("4", {
    message: "Client ID tidak valid.",
  })
  clientId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  position!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  department?: string;

  @IsEmail(
    {},
    {
      message: "Format email tidak valid.",
    },
  )
  email!: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
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
