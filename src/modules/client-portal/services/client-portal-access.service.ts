import { ClientStatus } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";

@injectable()
export class ClientPortalAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getClientContext(actorId: string) {
    const contact = await this.prisma.contactPerson.findUnique({
      where: {
        userId: actorId,
      },
      select: {
        id: true,
        clientId: true,
        fullName: true,
        email: true,
        status: true,
        isPrimary: true,
        client: {
          select: {
            id: true,
            clientCode: true,
            companyName: true,
            status: true,
          },
        },
      },
    });

    if (!contact) {
      throw new ApiError("Akun ini belum terhubung ke client portal.", 403);
    }

    if (contact.status !== ClientStatus.ACTIVE) {
      throw new ApiError("Akses contact person sedang tidak aktif.", 403);
    }

    if (contact.client.status !== ClientStatus.ACTIVE) {
      throw new ApiError("Akses client sedang tidak aktif.", 403);
    }

    return {
      userId: actorId,
      contactId: contact.id,
      clientId: contact.clientId,
      contactName: contact.fullName,
      contactEmail: contact.email,
      isPrimaryContact: contact.isPrimary,
      client: contact.client,
    };
  }

  async ensureProjectAccess(projectId: string, actorId: string) {
    const context = await this.getClientContext(actorId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        clientId: context.clientId,
      },
      select: {
        id: true,
        projectCode: true,
        name: true,
        status: true,
        clientId: true,
      },
    });

    if (!project) {
      throw new ApiError(
        "Project tidak ditemukan atau tidak dapat diakses.",
        404,
      );
    }

    return {
      context,
      project,
    };
  }
}
