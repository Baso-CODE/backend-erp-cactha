import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateClientSupportMessageDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;
}
