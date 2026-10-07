import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RejectPaymentDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rejectionReason!: string;
}
