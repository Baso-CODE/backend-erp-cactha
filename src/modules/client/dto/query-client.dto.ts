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

export class QueryClientDTO {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(ClientStatus)
  @IsOptional()
  status?: ClientStatus;

  @IsUUID("4", {
    message: "Account Manager ID tidak valid.",
  })
  @IsOptional()
  accountManagerId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 1 : parseInt(value, 10)))
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 10 : parseInt(value, 10)))
  limit?: number = 10;
}
