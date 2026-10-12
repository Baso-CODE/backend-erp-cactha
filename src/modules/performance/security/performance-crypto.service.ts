import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { injectable } from "tsyringe";

@injectable()
export class PerformanceCryptoService {
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.PERFORMANCE_ENCRYPTION_KEY;

    if (!secret || !/^[0-9a-fA-F]{64}$/.test(secret)) {
      throw new Error(
        "PERFORMANCE_ENCRYPTION_KEY harus berupa 64 karakter hex.",
      );
    }

    this.key = Buffer.from(secret, "hex");
  }

  encrypt(value: string): string {
    if (!value)
      throw new Error("Nilai yang akan dienkripsi tidak boleh kosong.");

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);

    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }

  decrypt(value: string): string {
    const [version, ivValue, tagValue, ciphertext] = value.split(".");

    if (version !== "v1" || !ivValue || !tagValue || !ciphertext) {
      throw new Error("Format credential terenkripsi tidak valid.");
    }

    const iv = Buffer.from(ivValue, "base64url");
    const tag = Buffer.from(tagValue, "base64url");

    if (iv.length !== 12 || tag.length !== 16) {
      throw new Error("Metadata credential tidak valid.");
    }

    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}
