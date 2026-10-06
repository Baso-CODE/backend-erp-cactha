import { AccessScope, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { CloudinaryService } from "../../../common/cloudinary.service";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";

@injectable()
export class TaskAttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private async buildAccessWhere(
    actorId: string,
    permission: string,
  ): Promise<Prisma.TaskWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    switch (scope) {
      case AccessScope.ALL:
        return {};

      case AccessScope.TEAM: {
        const teamMemberIds =
          await this.accessScopeService.getTeamMemberIds(actorId);

        return {
          assigneeId: {
            in: teamMemberIds,
          },
        };
      }

      case AccessScope.PROJECT:
        return {
          project: {
            projectManagerId: actorId,
          },
        };

      case AccessScope.OWN:
        return {
          assigneeId: actorId,
        };

      case AccessScope.CLIENT:
      default:
        throw new ApiError(
          `Scope ${scope} belum didukung untuk resource Task`,
          403,
        );
    }
  }

  private async getAccessibleTask(
    taskId: string,
    actorId: string,
    permission: string,
  ) {
    const accessWhere = await this.buildAccessWhere(actorId, permission);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        ...accessWhere,
      },
      select: {
        id: true,
        taskCode: true,
        title: true,
      },
    });

    if (!task) {
      throw new ApiError("Task tidak ditemukan atau tidak dapat diakses", 404);
    }

    return task;
  }

  async getAll(taskId: string, actorId: string) {
    await this.getAccessibleTask(taskId, actorId, "task.read");

    return this.prisma.attachment.findMany({
      where: {
        taskId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async create(taskId: string, actorId: string, file: Express.Multer.File) {
    const task = await this.getAccessibleTask(
      taskId,
      actorId,
      "task.attachment.create",
    );

    const uploadResult = await this.cloudinaryService.uploadBuffer(
      file,
      `digital-marketing-erp/tasks/${taskId}`,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const attachment = await tx.attachment.create({
          data: {
            fileName: file.originalname,
            fileUrl: uploadResult.secure_url,
            fileType: file.mimetype,
            fileSize: file.size,
            publicId: uploadResult.public_id,
            resourceType: uploadResult.resource_type,
            taskId,
            uploadedById: actorId,
          },
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "ATTACHMENT_CREATE",
            entity: "Task",
            entityId: taskId,
            details: {
              type: "ATTACHMENT",
              attachmentId: attachment.id,
              taskCode: task.taskCode,
              fileName: attachment.fileName,
              fileUrl: attachment.fileUrl,
              fileType: attachment.fileType,
              fileSize: attachment.fileSize,
            },
          },
        });

        return attachment;
      });
    } catch (error) {
      if (uploadResult.public_id) {
        await this.cloudinaryService.deleteFile(
          uploadResult.public_id,
          this.normalizeResourceType(uploadResult.resource_type),
        );
      }

      throw error;
    }
  }

  async delete(id: string, actorId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            id: true,
            taskCode: true,
            projectId: true,
            assigneeId: true,
            project: {
              select: {
                projectManagerId: true,
              },
            },
          },
        },
      },
    });

    if (!attachment || !attachment.task) {
      throw new ApiError("Attachment task tidak ditemukan", 404);
    }

    const accessWhere = await this.buildAccessWhere(
      actorId,
      "task.attachment.delete",
    );

    const accessibleTask = await this.prisma.task.findFirst({
      where: {
        id: attachment.task.id,
        ...accessWhere,
      },
      select: {
        id: true,
      },
    });

    if (!accessibleTask) {
      throw new ApiError("Attachment tidak dapat diakses", 404);
    }

    if (attachment.publicId) {
      await this.cloudinaryService.deleteFile(
        attachment.publicId,
        this.normalizeResourceType(attachment.resourceType),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "ATTACHMENT_DELETE",
          entity: "Task",
          entityId: attachment.taskId!,
          details: {
            type: "ATTACHMENT",
            attachmentId: attachment.id,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
          },
        },
      });

      await tx.attachment.delete({
        where: {
          id,
        },
      });

      return {
        message: "Attachment berhasil dihapus",
      };
    });
  }

  private normalizeResourceType(
    resourceType?: string | null,
  ): "image" | "video" | "raw" {
    if (resourceType === "video") {
      return "video";
    }

    if (resourceType === "raw") {
      return "raw";
    }

    return "image";
  }
}
