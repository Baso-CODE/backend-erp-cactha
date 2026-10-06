import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const isLocalRequest = (req: Request) => {
  return req.ip === "127.0.0.1" || req.ip === "::1";
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Terlalu banyak request, coba lagi nanti",
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalRequest,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Terlalu banyak percobaan login, coba lagi dalam 15 menit",
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: Request) => {
    const ip = req.ip ? ipKeyGenerator(req.ip) : "unknown";

    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "unknown";

    return `${ip}:${email}`;
  },

  skip: isLocalRequest,
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Terlalu banyak request sensitif, coba lagi nanti",
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalRequest,
});

export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  message: "Terlalu banyak request, coba lagi nanti",
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLocalRequest,
});
