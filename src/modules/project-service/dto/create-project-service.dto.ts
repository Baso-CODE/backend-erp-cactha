import { Type } from "class-transformer";
import { IsDate, IsOptional, IsUUID } from "class-validator";

export class CreateProjectServiceDTO {
  @IsUUID("4", {
    message: "Project ID tidak valid.",
  })
  projectId!: string;

  @IsUUID("4", {
    message: "Master Service ID tidak valid.",
  })
  masterServiceId!: string;

  @Type(() => Date)
  @IsDate({
    message: "Start date tidak valid.",
  })
  @IsOptional()
  startDate?: Date;

  @Type(() => Date)
  @IsDate({
    message: "End date tidak valid.",
  })
  @IsOptional()
  endDate?: Date;
}
