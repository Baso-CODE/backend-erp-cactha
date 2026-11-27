import { QuotationStatus } from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export class UpdateQuotationDTO {
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999999.99)
  amount?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  masterServiceIds?: string[];
}
