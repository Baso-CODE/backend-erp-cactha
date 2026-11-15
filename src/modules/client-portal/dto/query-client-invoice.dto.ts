import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class QueryClientInvoiceDTO {
  @IsOptional()
  @IsIn(["ALL", "OUTSTANDING", "OVERDUE", "PAID"])
  filter?: "ALL" | "OUTSTANDING" | "OVERDUE" | "PAID";

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
