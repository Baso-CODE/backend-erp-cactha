import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AuthService } from "./auth.service";

@injectable()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.body);

      // 1. Tanamkan Token ke dalam HTTP-Only Cookie
      res.cookie("token", result.token, {
        httpOnly: true, // Mencegah akses dari XSS (JavaScript di browser)
        secure: process.env.NODE_ENV === "production", // Wajib HTTPS jika di server production
        sameSite: "lax", // Standar keamanan untuk navigasi antar halaman
        maxAge: 24 * 60 * 60 * 1000, // 1 hari (sesuaikan dengan waktu token JWT)
      });

      // 2. Kirim response HANYA berisi data user, JANGAN sertakan token di sini
      res.status(200).json({
        success: true,
        message: "Login berhasil",
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // 3. Tambahkan fungsi Logout untuk menghapus Cookie
  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      res.status(200).json({
        success: true,
        message: "Berhasil keluar sistem",
      });
    } catch (error) {
      next(error);
    }
  };
}
