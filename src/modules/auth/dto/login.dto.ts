import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDTO {
  @IsEmail({}, { message: "Format email tidak valid" })
  @IsNotEmpty({ message: "Email wajib diisi" })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: "Password wajib diisi" })
  password!: string;
}
