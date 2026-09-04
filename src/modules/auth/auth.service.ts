import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { injectable } from "tsyringe";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDTO } from "./dto/login.dto";

@injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(data: LoginDTO) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error("Email atau password salah.");
    }

    if (!user.isActive) {
      throw new Error(
        "Akun Anda dinonaktifkan. Silakan hubungi Administrator.",
      );
    }

    const validPassword = await argon2.verify(user.password, data.password);
    if (!validPassword) {
      throw new Error("Email atau password salah.");
    }

    const payload = {
      id: user.id,
      role: user.role,
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET belum dikonfigurasi di server.");
    }

    const token = jwt.sign(payload, secret, {
      expiresIn: "1d",
    });

    const { password, ...safeUser } = user;

    return {
      user: safeUser,
      token,
    };
  }
}
