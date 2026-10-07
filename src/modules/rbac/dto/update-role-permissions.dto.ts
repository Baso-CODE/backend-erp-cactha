import { AccessScope } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsString,
  ValidateNested,
} from "class-validator";

class RolePermissionItemDTO {
  @IsString()
  permissionId!: string;

  @IsEnum(AccessScope)
  scope!: AccessScope;
}

export class UpdateRolePermissionsDTO {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionItemDTO)
  permissions!: RolePermissionItemDTO[];
}
