// dto/update-proposal.dto.ts

import { ProposalStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdateProposalDTO {
  @IsString()
  @IsOptional()
  subject?: string;

  @IsNumber({}, { message: "Amount harus berupa angka" })
  @Min(0, { message: "Amount tidak boleh negatif" })
  @IsOptional()
  amount?: number;

  @IsDateString({}, { message: "Proposal date tidak valid" })
  @IsOptional()
  proposalDate?: string;

  @IsDateString({}, { message: "Valid until tidak valid" })
  @IsOptional()
  validUntil?: string;

  @IsEnum(ProposalStatus, { message: "Status proposal tidak valid" })
  @IsOptional()
  status?: ProposalStatus;

  @IsString()
  @IsOptional()
  fileUrl?: string;
}
