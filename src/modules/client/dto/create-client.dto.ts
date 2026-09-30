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

export class CreateClientDTO {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  companyName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  industry?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
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
  accountManagerId!: string;

  @IsUUID("4", {
    message: "Source Lead ID tidak valid.",
  })
  @IsOptional()
  sourceLeadId?: string;
}
