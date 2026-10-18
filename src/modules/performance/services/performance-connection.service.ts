import {
  AccessScope,
  PerformanceConnectionStatus,
  Prisma,
} from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreatePerformanceConnectionDTO,
  QueryPerformanceConnectionDTO,
  UpdatePerformanceConnectionDTO,
} from "../dto/performance-connection.dto";

const connectionSelect = {
  id: true,
  platform: true,
  name: true,
  status: true,
  externalId: true,
  connectedBy: true,
  syncEnabled: true,
  lastSuccessfulSyncAt: true,
  dataThrough: true,
  nextScheduledSyncAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      accounts: true,
      syncJobs: true,
    },
  },
} satisfies Prisma.PerformanceConnectionSelect;

@injectable()
export class PerformanceConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async assertManageScope(
    actorId: string,
    permission:
      | "performance.connection.create"
      | "performance.connection.update",
  ): Promise<void> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    if (scope !== AccessScope.ALL) {
      throw new ApiError(
        "Scope ALL diperlukan untuk mengelola Connection.",
        403,
      );
    }
  }

  private async getReadWhere(
    actorId: string,
  ): Promise<Prisma.PerformanceConnectionWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "performance.connection.read",
    );

    switch (scope) {
      case AccessScope.ALL:
        return {};
      case AccessScope.OWN:
        return { connectedBy: actorId };
      case AccessScope.TEAM: {
        const members = await this.accessScopeService.getTeamMemberIds(actorId);
        return {
          connectedBy: { in: [...new Set([actorId, ...members])] },
        };
      }
      case AccessScope.PROJECT:
        return {
          accounts: {
            some: {
              mappings: {
                some: {
                  isActive: true,
                  project: { projectManagerId: actorId },
                },
              },
            },
          },
        };
      case AccessScope.CLIENT:
        throw new ApiError(
          "Scope CLIENT tidak didukung untuk Connection.",
          403,
        );
      default:
        throw new ApiError(
          `Scope ${scope} tidak didukung untuk Connection.`,
          403,
        );
    }
  }

  async getAll(query: QueryPerformanceConnectionDTO, actorId: string) {
    const scopeWhere = await this.getReadWhere(actorId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim();

    const where: Prisma.PerformanceConnectionWhereInput = {
      AND: [
        scopeWhere,
        ...(query.platform ? [{ platform: query.platform }] : []),
        ...(search
          ? [{ name: { contains: search, mode: "insensitive" as const } }]
          : []),
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.performanceConnection.count({ where }),
      this.prisma.performanceConnection.findMany({
        where,
        select: connectionSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, actorId: string) {
    const scopeWhere = await this.getReadWhere(actorId);

    const connection = await this.prisma.performanceConnection.findFirst({
      where: { AND: [scopeWhere, { id }] },
      select: connectionSelect,
    });

    if (!connection) {
      throw new ApiError("Connection tidak ditemukan atau akses ditolak.", 404);
    }

    return connection;
  }

  async create(dto: CreatePerformanceConnectionDTO, actorId: string) {
    await this.assertManageScope(actorId, "performance.connection.create");

    const name = dto.name.trim();
    if (name.length < 2) {
      throw new ApiError("Nama connection minimal 2 karakter.", 400);
    }

    return this.prisma.performanceConnection.create({
      data: {
        platform: dto.platform,
        name,
        connectedBy: actorId,
        status: PerformanceConnectionStatus.DISABLED,
        syncEnabled: false,
      },
      select: connectionSelect,
    });
  }

  async update(
    id: string,
    dto: UpdatePerformanceConnectionDTO,
    actorId: string,
  ) {
    await this.assertManageScope(actorId, "performance.connection.update");

    const existing = await this.prisma.performanceConnection.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    if (
      dto.syncEnabled === true &&
      existing.status !== PerformanceConnectionStatus.CONNECTED
    ) {
      throw new ApiError(
        "Aktifkan OAuth connection terlebih dahulu sebelum mengaktifkan sync.",
        400,
      );
    }

    const name = dto.name?.trim();
    if (name !== undefined && name.length < 2) {
      throw new ApiError("Nama connection minimal 2 karakter.", 400);
    }

    const updated = await this.prisma.performanceConnection.updateMany({
      where: {
        id,
        ...(dto.syncEnabled === true && {
          status: PerformanceConnectionStatus.CONNECTED,
        }),
      },
      data: {
        ...(name !== undefined && { name }),
        ...(dto.syncEnabled !== undefined && {
          syncEnabled: dto.syncEnabled,
        }),
      },
    });

    if (updated.count !== 1) {
      throw new ApiError(
        "Connection berubah status. Silakan refresh dan coba kembali.",
        409,
      );
    }

    return this.prisma.performanceConnection.findUniqueOrThrow({
      where: { id },
      select: connectionSelect,
    });
  }

  async disable(id: string, actorId: string) {
    await this.assertManageScope(actorId, "performance.connection.update");

    const existing = await this.prisma.performanceConnection.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    return this.prisma.performanceConnection.update({
      where: { id },
      data: {
        status: PerformanceConnectionStatus.DISABLED,
        syncEnabled: false,
        nextScheduledSyncAt: null,
      },
      select: connectionSelect,
    });
  }
}
