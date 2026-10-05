import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateTaskCommentDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  comment!: string;
}
