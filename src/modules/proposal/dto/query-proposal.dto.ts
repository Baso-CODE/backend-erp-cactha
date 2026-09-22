// dto/query-proposal.dto.ts

import { ProposalStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryProposalDTO {
  @IsUUID("4", { message: "Lead ID tidak valid" })
  @IsOptional()
  leadId?: string;

  @IsEnum(ProposalStatus, { message: "Status proposal tidak valid" })
  @IsOptional()
  status?: ProposalStatus;

  @IsString()
  @IsOptional()
  search?: string;

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
