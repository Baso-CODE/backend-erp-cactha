import { TaskStatus } from "@prisma/client";
import { IsEnum, IsNumber } from "class-validator";

export class MoveTaskDTO {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsNumber()
  position!: number;
}
