import { ClientStatus } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateClientDTO {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  companyName?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  industry?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  businessType?: string;

  @IsUrl(
    {
      require_protocol: true,
    },
    {
      message: "Website harus berupa URL yang valid.",
    },
  )
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEnum(ClientStatus)
  @IsOptional()
  status?: ClientStatus;

  @IsUUID("4", {
    message: "Account Manager ID tidak valid.",
  })
  @IsOptional()
  accountManagerId?: string;
}
