import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateClientDTO } from "./dto/create-client.dto";
import { QueryClientDTO } from "./dto/query-client.dto";
import { UpdateClientDTO } from "./dto/update-client.dto";

@injectable()
export class ClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async validateAccountManager(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        isActive: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error("Account Manager tidak ditemukan.");
    }

    if (!user.isActive) {
      throw new Error("Account Manager tidak aktif.");
    }

    const hasAccountManagerRole = user.roles.some(
      ({ role }) => role.code === "ACCOUNT_MANAGER",
    );

    if (!hasAccountManagerRole) {
      throw new Error("User yang dipilih bukan Account Manager.");
    }

    return user;
  }

  async getAllClients(query: QueryClientDTO, actorId: string) {
    const { search, status, accountManagerId, page = 1, limit = 10 } = query;

    const skip = (page - 1) * limit;

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "client.read",
    );

    const accessFilter: Prisma.ClientWhereInput =
      scope === "ALL"
        ? {}
        : {
            accountManagerId: actorId,
          };

    const where: Prisma.ClientWhereInput = {
      AND: [
        accessFilter,
        {
          ...(status && {
            status,
          }),
          ...(accountManagerId && {
            accountManagerId,
          }),
          ...(search && {
            OR: [
              {
                clientCode: {
                  contains: search,
                },
              },
              {
                companyName: {
                  contains: search,
                },
              },
              {
                industry: {
                  contains: search,
                },
              },
              {
                businessType: {
                  contains: search,
                },
              },
              {
                website: {
                  contains: search,
                },
              },
              {
                accountManager: {
                  name: {
                    contains: search,
                  },
                },
              },
            ],
          }),
        },
      ],
    };

    const [clients, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          accountManager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              contacts: true,
              contracts: true,
              projects: true,
              tickets: true,
              invoices: true,
            },
          },
        },
      }),

      this.prisma.client.count({
        where,
      }),
    ]);

    return {
      data: clients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getClientById(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "client.read",
    );

    const client = await this.prisma.client.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          accountManagerId: actorId,
        }),
      },
      include: {
        accountManager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contacts: {
          orderBy: [
            {
              isPrimary: "desc",
            },
            {
              createdAt: "asc",
            },
          ],
        },
        contracts: {
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            contacts: true,
            contracts: true,
            projects: true,
            tickets: true,
            invoices: true,
          },
        },
      },
    });

    if (!client) {
      throw new Error("Client tidak ditemukan atau Anda tidak memiliki akses.");
    }

    return client;
  }

  async createClient(data: CreateClientDTO, actorId: string) {
    await this.validateAccountManager(data.accountManagerId);

    if (data.sourceLeadId) {
      const lead = await this.prisma.lead.findUnique({
        where: {
          id: data.sourceLeadId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!lead) {
        throw new Error("Source lead tidak ditemukan.");
      }

      if (lead.status !== "WON") {
        throw new Error(
          "Client hanya dapat dibuat dari lead dengan status WON.",
        );
      }

      const existingClient = await this.prisma.client.findUnique({
        where: {
          sourceLeadId: data.sourceLeadId,
        },
        select: {
          id: true,
        },
      });

      if (existingClient) {
        throw new Error("Lead ini sudah pernah dikonversi menjadi client.");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: {
          key: "CLIENT",
        },
        update: {
          value: {
            increment: 1,
          },
        },
        create: {
          key: "CLIENT",
          value: 1,
        },
      });

      const clientCode = `CLIENT-${String(counter.value).padStart(6, "0")}`;

      const client = await tx.client.create({
        data: {
          clientCode,
          companyName: data.companyName,
          industry: data.industry,
          businessType: data.businessType,
          website: data.website,
          address: data.address,
          status: data.status ?? "ACTIVE",
          accountManagerId: data.accountManagerId,
          sourceLeadId: data.sourceLeadId,
        },
        include: {
          accountManager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sourceLead: {
            select: {
              id: true,
              leadCode: true,
              company: true,
              status: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Client",
          entityId: client.id,
          details: {
            clientCode: client.clientCode,
            companyName: client.companyName,
            status: client.status,
            accountManagerId: client.accountManagerId,
            sourceLeadId: client.sourceLeadId,
          },
        },
      });

      return client;
    });
  }
  async updateClient(id: string, data: UpdateClientDTO, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "client.update",
    );

    const existing = await this.prisma.client.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          accountManagerId: actorId,
        }),
      },
    });

    if (!existing) {
      throw new Error("Client tidak ditemukan atau Anda tidak memiliki akses.");
    }

    if (
      data.accountManagerId !== undefined &&
      data.accountManagerId !== existing.accountManagerId
    ) {
      await this.accessScopeService.getPermissionScope(
        actorId,
        "client.assign",
      );

      await this.validateAccountManager(data.accountManagerId);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({
        where: {
          id,
        },
        data: {
          ...(data.companyName !== undefined && {
            companyName: data.companyName,
          }),
          ...(data.industry !== undefined && {
            industry: data.industry,
          }),
          ...(data.businessType !== undefined && {
            businessType: data.businessType,
          }),
          ...(data.website !== undefined && {
            website: data.website,
          }),
          ...(data.address !== undefined && {
            address: data.address,
          }),
          ...(data.status !== undefined && {
            status: data.status,
          }),
          ...(data.accountManagerId !== undefined && {
            accountManagerId: data.accountManagerId,
          }),
        },
        include: {
          accountManager: {
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
          action: "UPDATE",
          entity: "Client",
          entityId: id,
          details: {
            before: {
              companyName: existing.companyName,
              industry: existing.industry,
              businessType: existing.businessType,
              website: existing.website,
              address: existing.address,
              status: existing.status,
              accountManagerId: existing.accountManagerId,
            },
            after: {
              companyName: updated.companyName,
              industry: updated.industry,
              businessType: updated.businessType,
              website: updated.website,
              address: updated.address,
              status: updated.status,
              accountManagerId: updated.accountManagerId,
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteClient(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "client.delete",
    );

    const existing = await this.prisma.client.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          accountManagerId: actorId,
        }),
      },
      include: {
        _count: {
          select: {
            contacts: true,
            contracts: true,
            projects: true,
            tickets: true,
            invoices: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("Client tidak ditemukan atau Anda tidak memiliki akses.");
    }

    const hasRelatedData =
      existing._count.contacts > 0 ||
      existing._count.contracts > 0 ||
      existing._count.projects > 0 ||
      existing._count.tickets > 0 ||
      existing._count.invoices > 0;

    if (hasRelatedData) {
      throw new Error(
        "Client tidak dapat dihapus karena sudah memiliki data terkait.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.client.delete({
        where: {
          id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Client",
          entityId: id,
          details: {
            clientCode: existing.clientCode,
            companyName: existing.companyName,
            accountManagerId: existing.accountManagerId,
          },
        },
      });
    });

    return {
      message: `Client "${existing.companyName}" berhasil dihapus.`,
    };
  }
}
