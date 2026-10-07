import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { ClientPortalUserService } from "../client-portal/services/client-portal-user.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContactPersonDTO } from "./dto/create-contact-person.dto";
import { QueryContactPersonDTO } from "./dto/query-contact-person.dto";
import { UpdateContactPersonDTO } from "./dto/update-contact-person.dto";

@injectable()
export class ContactPersonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
    private readonly clientPortalUserService: ClientPortalUserService,
  ) {}

  private async getAccessibleClient(
    clientId: string,
    actorId: string,
    permission: string,
  ) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        ...(scope !== "ALL" && {
          accountManagerId: actorId,
        }),
      },
      select: {
        id: true,
        clientCode: true,
        companyName: true,
        accountManagerId: true,
      },
    });

    if (!client) {
      throw new Error("Client tidak ditemukan atau Anda tidak memiliki akses.");
    }

    return client;
  }

  async getAllContactPersons(query: QueryContactPersonDTO, actorId: string) {
    const { clientId, search, status, page = 1, limit = 10 } = query;

    const skip = (page - 1) * limit;

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "client.contact.read",
    );

    const accessFilter: Prisma.ContactPersonWhereInput =
      scope === "ALL"
        ? {}
        : {
            client: {
              accountManagerId: actorId,
            },
          };

    const where: Prisma.ContactPersonWhereInput = {
      AND: [
        accessFilter,
        {
          ...(clientId && { clientId }),
          ...(status && { status }),
          ...(search && {
            OR: [
              {
                fullName: {
                  contains: search,
                },
              },
              {
                position: {
                  contains: search,
                },
              },
              {
                department: {
                  contains: search,
                },
              },
              {
                email: {
                  contains: search,
                },
              },
              {
                phone: {
                  contains: search,
                },
              },
              {
                mobile: {
                  contains: search,
                },
              },
              {
                client: {
                  companyName: {
                    contains: search,
                  },
                },
              },
            ],
          }),
        },
      ],
    };

    const [contacts, total] = await this.prisma.$transaction([
      this.prisma.contactPerson.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            isPrimary: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
              status: true,
            },
          },
        },
      }),

      this.prisma.contactPerson.count({
        where,
      }),
    ]);

    return {
      data: contacts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getContactPersonById(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "client.contact.read",
    );

    const contact = await this.prisma.contactPerson.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
      include: {
        client: {
          select: {
            id: true,
            clientCode: true,
            companyName: true,
            status: true,
            accountManagerId: true,
          },
        },
      },
    });

    if (!contact) {
      throw new Error(
        "Contact person tidak ditemukan atau Anda tidak memiliki akses.",
      );
    }

    return contact;
  }

  async createContactPerson(data: CreateContactPersonDTO, actorId: string) {
    await this.getAccessibleClient(
      data.clientId,
      actorId,
      "client.contact.create",
    );

    if (data.userId) {
      await this.clientPortalUserService.validatePortalUser(data.userId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.contactPerson.updateMany({
          where: {
            clientId: data.clientId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      const contact = await tx.contactPerson.create({
        data: {
          clientId: data.clientId,
          fullName: data.fullName,
          position: data.position,
          department: data.department,
          email: data.email,
          phone: data.phone,
          mobile: data.mobile,
          isPrimary: data.isPrimary ?? false,
          status: data.status ?? "ACTIVE",
          userId: data.userId || null,
        },
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "ContactPerson",
          entityId: contact.id,
          details: {
            clientId: contact.clientId,
            fullName: contact.fullName,
            email: contact.email,
            isPrimary: contact.isPrimary,
            portalUserId: contact.userId,
          },
        },
      });

      return contact;
    });
  }

  async updateContactPerson(
    id: string,
    data: UpdateContactPersonDTO,
    actorId: string,
  ) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "client.contact.update",
    );

    const existing = await this.prisma.contactPerson.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
    });

    if (!existing) {
      throw new ApiError(
        "Contact person tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    const targetClientId = data.clientId ?? existing.clientId;

    if (data.clientId !== undefined && data.clientId !== existing.clientId) {
      await this.getAccessibleClient(
        data.clientId,
        actorId,
        "client.contact.update",
      );
    }

    if (data.userId) {
      await this.clientPortalUserService.validatePortalUser(data.userId, id);
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.isPrimary === true) {
        await tx.contactPerson.updateMany({
          where: {
            clientId: targetClientId,
            isPrimary: true,
            NOT: {
              id,
            },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      const updated = await tx.contactPerson.update({
        where: {
          id,
        },
        data: {
          ...(data.clientId !== undefined && {
            clientId: data.clientId,
          }),
          ...(data.fullName !== undefined && {
            fullName: data.fullName,
          }),
          ...(data.position !== undefined && {
            position: data.position,
          }),
          ...(data.department !== undefined && {
            department: data.department,
          }),
          ...(data.email !== undefined && {
            email: data.email,
          }),
          ...(data.phone !== undefined && {
            phone: data.phone,
          }),
          ...(data.mobile !== undefined && {
            mobile: data.mobile,
          }),
          ...(data.isPrimary !== undefined && {
            isPrimary: data.isPrimary,
          }),
          ...(data.status !== undefined && {
            status: data.status,
          }),
          ...(data.userId !== undefined && {
            userId: data.userId || null,
          }),
        },
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "ContactPerson",
          entityId: id,
          details: {
            before: {
              clientId: existing.clientId,
              fullName: existing.fullName,
              position: existing.position,
              department: existing.department,
              email: existing.email,
              phone: existing.phone,
              mobile: existing.mobile,
              isPrimary: existing.isPrimary,
              status: existing.status,
              portalUserId: existing.userId,
            },
            after: {
              clientId: updated.clientId,
              fullName: updated.fullName,
              position: updated.position,
              department: updated.department,
              email: updated.email,
              phone: updated.phone,
              mobile: updated.mobile,
              isPrimary: updated.isPrimary,
              status: updated.status,
              portalUserId: updated.userId,
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteContactPerson(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "client.contact.delete",
    );

    const existing = await this.prisma.contactPerson.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
      include: {
        _count: {
          select: {
            approvalRequests: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error(
        "Contact person tidak ditemukan atau Anda tidak memiliki akses.",
      );
    }

    if (existing._count.approvalRequests > 0) {
      throw new Error(
        "Contact person tidak dapat dihapus karena sudah memiliki approval request.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contactPerson.delete({
        where: {
          id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "ContactPerson",
          entityId: id,
          details: {
            clientId: existing.clientId,
            fullName: existing.fullName,
            email: existing.email,
            isPrimary: existing.isPrimary,
          },
        },
      });
    });

    return {
      message: `Contact person "${existing.fullName}" berhasil dihapus.`,
    };
  }
}
