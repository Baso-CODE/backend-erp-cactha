import { Type } from "class-transformer";
import { IsDate, IsOptional, ValidateIf } from "class-validator";

export class UpdateProjectServiceDTO {
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Type(() => Date)
  @IsDate({
    message: "Start date tidak valid.",
  })
  @IsOptional()
  startDate?: Date | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Type(() => Date)
  @IsDate({
    message: "End date tidak valid.",
  })
  @IsOptional()
  endDate?: Date | null;
}
