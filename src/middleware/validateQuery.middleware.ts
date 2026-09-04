import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { NextFunction, Request, Response } from "express";

type ClassConstructor<T> = new (...args: any[]) => T;

/**
 * Middleware validasi untuk req.query menggunakan class-validator.
 * Otomatis mengubah string query param ke tipe yang sesuai (via class-transformer).
 *
 * Contoh pemakaian:
 *   router.get("/users", validateQuery(QueryUserDTO), controller.getAllUsers)
 */
export const validateQuery = <T extends object>(dto: ClassConstructor<T>) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Transformasi plain object (req.query) ke instance DTO
    // enableImplicitConversion: true → string "10" jadi number 10 secara otomatis
    const instance = plainToInstance(dto, req.query, {
      enableImplicitConversion: true,
    });

    const errors = await validate(instance as object, {
      whitelist: true, // Buang field yang tidak ada di DTO
      forbidNonWhitelisted: false, // Jangan error jika ada field ekstra (query string bebas)
      skipMissingProperties: true, // Semua field di query bersifat opsional by default
    });

    if (errors.length > 0) {
      const messages = errors.flatMap((err) =>
        Object.values(err.constraints ?? {}),
      );

      res.status(400).json({
        success: false,
        message: "Query parameter tidak valid.",
        errors: messages,
      });
      return;
    }

    // Ganti req.query dengan instance yang sudah bersih & bertipe benar
    (req as any).validatedQuery = instance;
    next();
  };
};
