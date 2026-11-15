import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class UpdateSupportTicketDTO {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;
}
