import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateSupportReplyDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;
}
