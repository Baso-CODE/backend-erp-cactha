import { TaskStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsUUID, ValidateIf } from "class-validator";

export class MoveTaskDTO {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  beforeTaskId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  afterTaskId?: string | null;
}
