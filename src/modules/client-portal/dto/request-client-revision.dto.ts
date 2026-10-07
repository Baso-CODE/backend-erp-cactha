import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RequestClientRevisionDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  feedback!: string;
}
