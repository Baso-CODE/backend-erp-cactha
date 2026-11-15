import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { injectable } from "tsyringe";
import { ApiError } from "../utils/api-error";

@injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadBuffer(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new ApiError(
                error?.message || "Gagal mengupload file ke Cloudinary",
                500,
              ),
            );
            return;
          }

          resolve(result);
        },
      );

      stream.end(file.buffer);
    });
  }

  async deleteFile(
    publicId: string,
    resourceType: "image" | "video" | "raw" = "image",
  ) {
    try {
      return await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
    } catch {
      throw new ApiError("Gagal menghapus file dari Cloudinary", 500);
    }
  }

  async uploadAuthenticatedDocument(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadApiResponse> {
    const extension = extname(file.originalname).toLowerCase();

    const publicId = `${folder}/${randomUUID()}${extension}`;

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          type: "authenticated",
          public_id: publicId,
          overwrite: false,
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new ApiError(
                error?.message || "Gagal mengupload dokumen ke Cloudinary.",
                500,
              ),
            );
            return;
          }

          resolve(result);
        },
      );

      stream.end(file.buffer);
    });
  }

  getAuthenticatedDownloadUrl(publicId: string): string {
    const extension = extname(publicId).replace(".", "").toLowerCase();

    if (!extension) {
      throw new ApiError("Format dokumen tidak dapat ditentukan.", 400);
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 60;

    return cloudinary.utils.private_download_url(publicId, extension, {
      resource_type: "raw",
      type: "authenticated",
      expires_at: expiresAt,
      attachment: true,
    });
  }

  async deleteAuthenticatedDocument(publicId: string) {
    return cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    });
  }
}
