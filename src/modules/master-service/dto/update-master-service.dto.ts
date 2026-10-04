import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateMasterServiceDTO {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  code?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID("4", {
    message: "Workflow Template ID tidak valid.",
  })
  @IsOptional()
  workflowTemplateId?: string | null;
}
