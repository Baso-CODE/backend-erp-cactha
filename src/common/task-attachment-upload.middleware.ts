import multer from "multer";
import { ApiError } from "../utils/api-error";

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const taskAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(
        new ApiError(
          "Format file tidak didukung. Gunakan JPG, PNG, WEBP, PDF, DOC, DOCX, XLS, atau XLSX",
          400,
        ),
      );
      return;
    }

    callback(null, true);
  },
});
