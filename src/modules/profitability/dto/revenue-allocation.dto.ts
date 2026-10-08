import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

export class RevenueAllocationItemDTO {
  @IsUUID("4")
  projectServiceId!: string;

  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/)
  amount!: string;
}

export class SaveRevenueAllocationsDTO {
  @IsArray()
  @ArrayUnique((item: RevenueAllocationItemDTO) => item.projectServiceId)
  @ValidateNested({ each: true })
  @Type(() => RevenueAllocationItemDTO)
  allocations!: RevenueAllocationItemDTO[];

  @IsInt()
  @Min(0)
  allocationVersion!: number;
}
