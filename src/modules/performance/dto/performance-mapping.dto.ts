import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class CreatePerformanceMappingDTO {
  @IsUUID("4")
  accountId!: string;

  @IsUUID("4")
  clientId!: string;

  @IsUUID("4")
  projectId!: string;

  @IsOptional()
  @IsUUID("4")
  projectServiceId?: string;
}

export class UpdatePerformanceMappingDTO {
  @IsUUID("4")
  clientId!: string;

  @IsUUID("4")
  projectId!: string;

  @IsOptional()
  @IsUUID("4")
  projectServiceId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
