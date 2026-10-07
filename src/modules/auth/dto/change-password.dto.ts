import { IsString, MinLength } from "class-validator";

export class ChangePasswordDTO {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8, {
    message: "Password baru minimal 8 karakter.",
  })
  newPassword!: string;
}
