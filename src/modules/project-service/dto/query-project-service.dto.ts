import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class QueryProjectServiceDTO {
  @IsUUID("4", {
    message: "Project ID tidak valid.",
  })
  @IsOptional()
  projectId?: string;

  @IsUUID("4", {
    message: "Master Service ID tidak valid.",
  })
  @IsOptional()
  masterServiceId?: string;

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
