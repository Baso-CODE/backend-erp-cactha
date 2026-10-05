import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateTaskChecklistDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsNumber()
  position?: number;
}
