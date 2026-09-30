import { ClientStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryContactPersonDTO {
  @IsUUID("4", {
    message: "Client ID tidak valid.",
  })
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(ClientStatus)
  @IsOptional()
  status?: ClientStatus;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 10;
}
