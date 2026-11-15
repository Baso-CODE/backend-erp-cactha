import {
  AccessScope,
  ApprovalStatus,
  AttachmentVisibility,
  Prisma,
} from "@prisma/client";
import { basename, extname } from "node:path";
import { injectable } from "tsyringe";

import { CloudinaryService } from "../../common/cloudinary.service";
import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { ClientPortalAccessService } from "../client-portal/services/client-portal-access.service";
import { PrismaService } from "../prisma/prisma.service";

const MAX_SIZE = 10 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const CLIENT_VISIBLE_STATUSES: ApprovalStatus[] = [
  ApprovalStatus.PENDING_CLIENT_APPROVAL,
  ApprovalStatus.REVISION_REQUIRED,
  ApprovalStatus.APPROVED,
];

@injectable()
export class DeliverableFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: AccessScopeService,
    private readonly cloudinary: CloudinaryService,
    private readonly clientAccess: ClientPortalAccessService,
  ) {}

  private validateFile(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new ApiError("File wajib diupload.", 400);
    }

    if (file.size > MAX_SIZE) {
      throw new ApiError("Ukuran file maksimal 10 MB.", 400);
    }

    const fileName = basename(file.originalname.replace(/\\/g, "/")).slice(
      0,
      200,
    );

    const extension = extname(fileName).toLowerCase();
    const expectedMime = MIME_TYPES[extension];

    if (!expectedMime || expectedMime !== file.mimetype) {
      throw new ApiError("Ekstensi atau MIME file tidak sesuai.", 400);
    }

    const buffer = file.buffer;

    const startsWith = (...bytes: number[]) =>
      buffer.length >= bytes.length &&
      bytes.every((byte, i) => buffer[i] === byte);

    let valid = false;

    switch (extension) {
      case ".pdf":
        valid = startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
        break;

      case ".jpg":
      case ".jpeg":
        valid = startsWith(0xff, 0xd8, 0xff);
        break;

      case ".png":
        valid = startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
        break;

      case ".webp":
        valid =
          buffer.length >= 12 &&
          buffer.toString("ascii", 0, 4) === "RIFF" &&
          buffer.toString("ascii", 8, 12) === "WEBP";
        break;

      case ".docx":
      case ".xlsx":
        // Pemeriksaan awal kontainer ZIP.
        // Ini bukan validasi penuh struktur Office.
        valid = startsWith(0x50, 0x4b, 0x03, 0x04);
        break;
    }

    if (!valid) {
      throw new ApiError("Signature file tidak sesuai dengan formatnya.", 400);
    }

    return fileName;
  }

  private async assertInternalAccess(
    projectId: string,
    actorId: string,
    permission: "project.read" | "project.update",
  ) {
    const scope = await this.scopes.getPermissionScope(actorId, permission);

    if (scope !== AccessScope.ALL && scope !== AccessScope.OWN) {
      throw new ApiError("Scope belum didukung untuk akses deliverable.", 403);
    }

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...(scope === AccessScope.OWN && {
          projectManagerId: actorId,
        }),
      },
      select: { id: true },
    });

    if (!project) {
      throw new ApiError("Project tidak ditemukan atau akses ditolak.", 404);
    }
  }

  private authenticatedWhere(
    deliverableId: string,
  ): Prisma.AttachmentWhereInput {
    return {
      deliverableId,
      resourceType: "raw",
      publicId: { not: null },
      fileUrl: {
        contains: "/raw/authenticated/",
      },
    };
  }

  async upload(
    deliverableId: string,
    actorId: string,
    file: Express.Multer.File,
  ) {
    const fileName = this.validateFile(file);

    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        id: true,
        projectId: true,
        status: true,
      },
    });

    if (!deliverable) {
      throw new ApiError("Deliverable tidak ditemukan.", 404);
    }

    await this.assertInternalAccess(
      deliverable.projectId,
      actorId,
      "project.update",
    );

    if (deliverable.status !== ApprovalStatus.DRAFT) {
      throw new ApiError("Upload hanya diizinkan pada deliverable DRAFT.", 409);
    }

    const uploaded = await this.cloudinary.uploadAuthenticatedDocument(
      file,
      `digital-marketing-erp/deliverables/${deliverableId}`,
    );

    let oldPublicIds: string[] = [];

    try {
      const attachment = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtext('deliverable-file'),
              hashtext(${deliverableId})
            )
          `;

        const current = await tx.deliverable.findUnique({
          where: { id: deliverableId },
          select: {
            status: true,
            projectId: true,
          },
        });

        if (
          !current ||
          current.projectId !== deliverable.projectId ||
          current.status !== ApprovalStatus.DRAFT
        ) {
          throw new ApiError(
            "Status deliverable berubah. Upload dibatalkan.",
            409,
          );
        }

        const oldFiles = await tx.attachment.findMany({
          where: this.authenticatedWhere(deliverableId),
          select: {
            id: true,
            publicId: true,
          },
        });

        oldPublicIds = oldFiles
          .map((item) => item.publicId)
          .filter((id): id is string => Boolean(id));

        if (oldFiles.length > 0) {
          await tx.attachment.deleteMany({
            where: {
              id: {
                in: oldFiles.map((item) => item.id),
              },
            },
          });
        }

        const created = await tx.attachment.create({
          data: {
            fileName,
            fileUrl: uploaded.secure_url,
            fileType: file.mimetype,
            fileSize: file.size,
            publicId: uploaded.public_id,
            resourceType: "raw",
            visibility: AttachmentVisibility.INTERNAL,
            projectId: deliverable.projectId,
            deliverableId,
            uploadedById: actorId,
          },
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
          },
        });

        // Hentikan penggunaan URL file manual.
        await tx.deliverable.update({
          where: { id: deliverableId },
          data: { fileUrl: null },
        });

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "UPLOAD_DELIVERABLE_FILE",
            entity: "Deliverable",
            entityId: deliverableId,
            details: {
              attachmentId: created.id,
              fileName,
              fileSize: file.size,
              projectId: deliverable.projectId,
            },
          },
        });

        return created;
      });

      // Hapus asset lama setelah transaksi DB berhasil.
      // Jika gagal, datanya tetap tidak bisa diakses lewat API baru.
      for (const oldPublicId of oldPublicIds) {
        try {
          await this.cloudinary.deleteAuthenticatedDocument(oldPublicId);
        } catch (error) {
          console.error("Gagal membersihkan asset deliverable lama:", error);
        }
      }

      return attachment;
    } catch (error) {
      // Rollback kompensasi: file baru tidak menjadi orphan.
      try {
        await this.cloudinary.deleteAuthenticatedDocument(uploaded.public_id);
      } catch (cleanupError) {
        console.error(
          "Gagal membersihkan upload yang dibatalkan:",
          cleanupError,
        );
      }

      throw error;
    }
  }

  private async findDownloadableFile(deliverableId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: this.authenticatedWhere(deliverableId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        publicId: true,
        fileName: true,
      },
    });

    if (!attachment?.publicId) {
      throw new ApiError("File deliverable tidak tersedia.", 404);
    }

    return {
      url: this.cloudinary.getAuthenticatedDownloadUrl(attachment.publicId),
      fileName: attachment.fileName,
      expiresInSeconds: 60,
    };
  }

  async getInternalDownload(deliverableId: string, actorId: string) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: { projectId: true },
    });

    if (!deliverable) {
      throw new ApiError("Deliverable tidak ditemukan.", 404);
    }

    await this.assertInternalAccess(
      deliverable.projectId,
      actorId,
      "project.read",
    );

    return this.findDownloadableFile(deliverableId);
  }

  async getClientDownload(deliverableId: string, actorId: string) {
    const context = await this.clientAccess.getClientContext(actorId);

    const deliverable = await this.prisma.deliverable.findFirst({
      where: {
        id: deliverableId,
        project: {
          clientId: context.clientId,
        },
        status: {
          in: CLIENT_VISIBLE_STATUSES,
        },
      },
      select: {
        id: true,
      },
    });

    if (!deliverable) {
      throw new ApiError(
        "File tidak ditemukan atau belum tersedia untuk client.",
        404,
      );
    }

    return this.findDownloadableFile(deliverableId);
  }
}
