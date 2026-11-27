import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export class CreateQuotationDTO {
  @IsDefined()
  @IsUUID("4", { message: "Lead ID tidak valid" })
  @IsNotEmpty({ message: "Lead wajib dipilih" })
  leadId!: string;

  @IsDefined()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999999.99)
  amount!: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  masterServiceIds?: string[];
}
