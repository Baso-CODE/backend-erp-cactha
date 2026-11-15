import multer from "multer";
import { ApiError } from "../utils/api-error";

export const deliverableUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(
        new ApiError(
          "Format file tidak didukung. Gunakan PDF, JPG, PNG, WEBP, DOCX, atau XLSX.",
          400,
        ),
      );
      return;
    }

    callback(null, true);
  },
});
