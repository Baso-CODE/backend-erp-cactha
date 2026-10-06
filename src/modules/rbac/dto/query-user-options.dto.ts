import { Transform } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class QueryUserOptionsDTO {
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;

    return String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
