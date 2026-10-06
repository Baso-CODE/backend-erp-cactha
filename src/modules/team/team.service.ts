import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { AddTeamMemberDTO } from "./dto/add-team-member.dto";
import { CreateTeamDTO } from "./dto/create-team.dto";
import { QueryTeamMemberOptionsDTO } from "./dto/query-team-member-options.dto";
import { QueryTeamDTO } from "./dto/query-team.dto";
import { UpdateTeamDTO } from "./dto/update-team.dto";

@injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async ensureGlobalPermission(
    actorId: string,
    permission: string,
  ): Promise<void> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    if (scope !== "ALL") {
      throw new ApiError(
        "Permission Team Management harus menggunakan scope ALL.",
        403,
      );
    }
  }

  private async ensureUniqueName(name: string, excludeId?: string) {
    const existing = await this.prisma.team.findFirst({
      where: {
        name: name.trim(),
        ...(excludeId && {
          id: {
            not: excludeId,
          },
        }),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ApiError("Nama team sudah digunakan.", 409);
    }
  }

  async getTeams(query: QueryTeamDTO, actorId: string) {
    await this.ensureGlobalPermission(actorId, "admin.team.read");

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.TeamWhereInput = {
      ...(query.isActive !== undefined && {
        isActive: query.isActive,
      }),
      ...(query.search && {
        OR: [
          {
            name: {
              contains: query.search.trim(),
            },
          },
          {
            description: {
              contains: query.search.trim(),
            },
          },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.team.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          _count: {
            select: {
              members: true,
            },
          },
        },
      }),
      this.prisma.team.count({
        where,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTeamById(id: string, actorId: string) {
    await this.ensureGlobalPermission(actorId, "admin.team.read");

    const team = await this.prisma.team.findUnique({
      where: {
        id,
      },
      include: {
        members: {
          orderBy: {
            joinedAt: "asc",
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!team) {
      throw new ApiError("Team tidak ditemukan.", 404);
    }

    return team;
  }

  async createTeam(data: CreateTeamDTO, actorId: string) {
    await this.ensureGlobalPermission(actorId, "admin.team.create");

    const name = data.name.trim();

    await this.ensureUniqueName(name);

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name,
          description: data.description?.trim() || null,
          isActive: data.isActive ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Team",
          entityId: team.id,
          details: {
            after: team,
          },
        },
      });

      return team;
    });
  }

  async updateTeam(id: string, data: UpdateTeamDTO, actorId: string) {
    await this.ensureGlobalPermission(actorId, "admin.team.update");

    const existing = await this.prisma.team.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new ApiError("Team tidak ditemukan.", 404);
    }

    if (data.name !== undefined) {
      await this.ensureUniqueName(data.name, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.update({
        where: {
          id,
        },
        data: {
          ...(data.name !== undefined && {
            name: data.name.trim(),
          }),
          ...(data.description !== undefined && {
            description: data.description.trim() || null,
          }),
          ...(data.isActive !== undefined && {
            isActive: data.isActive,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "Team",
          entityId: id,
          details: {
            before: existing,
            after: team,
          },
        },
      });

      return team;
    });
  }

  async deleteTeam(id: string, actorId: string) {
    await this.ensureGlobalPermission(actorId, "admin.team.delete");

    const existing = await this.prisma.team.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError("Team tidak ditemukan.", 404);
    }

    if (existing._count.members > 0) {
      throw new ApiError(
        "Team tidak dapat dihapus karena masih memiliki anggota. Hapus anggota terlebih dahulu atau nonaktifkan team.",
        409,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.team.delete({
        where: {
          id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Team",
          entityId: id,
          details: {
            before: existing,
          },
        },
      });
    });

    return {
      message: "Team berhasil dihapus.",
    };
  }

  async addMember(teamId: string, data: AddTeamMemberDTO, actorId: string) {
    await this.ensureGlobalPermission(actorId, "admin.team.manage_member");

    const [team, user] = await Promise.all([
      this.prisma.team.findUnique({
        where: {
          id: teamId,
        },
        select: {
          id: true,
          name: true,
        },
      }),
      this.prisma.user.findFirst({
        where: {
          id: data.userId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
    ]);

    if (!team) {
      throw new ApiError("Team tidak ditemukan.", 404);
    }

    if (!user) {
      throw new ApiError("User tidak ditemukan atau sudah tidak aktif.", 404);
    }

    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: data.userId,
        },
      },
    });

    if (existingMember) {
      throw new ApiError("User sudah menjadi anggota team ini.", 409);
    }

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.teamMember.create({
        data: {
          teamId,
          userId: data.userId,
        },
        include: {
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
          action: "TEAM_MEMBER_ADD",
          entity: "Team",
          entityId: teamId,
          details: {
            teamId,
            teamName: team.name,
            memberUserId: user.id,
            memberName: user.name,
            memberEmail: user.email,
          },
        },
      });

      return member;
    });
  }

  async removeMember(teamId: string, userId: string, actorId: string) {
    await this.ensureGlobalPermission(actorId, "admin.team.manage_member");

    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!member) {
      throw new ApiError("Anggota team tidak ditemukan.", 404);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.delete({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "TEAM_MEMBER_REMOVE",
          entity: "Team",
          entityId: teamId,
          details: {
            teamId,
            teamName: member.team.name,
            memberUserId: member.user.id,
            memberName: member.user.name,
            memberEmail: member.user.email,
          },
        },
      });
    });

    return {
      message: "Anggota berhasil dihapus dari team.",
    };
  }

  async getMemberOptions(
    teamId: string,
    query: QueryTeamMemberOptionsDTO,
    actorId: string,
  ) {
    await this.ensureGlobalPermission(actorId, "admin.team.manage_member");

    const team = await this.prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
      },
    });

    if (!team) {
      throw new ApiError("Team tidak ditemukan.", 404);
    }

    return this.prisma.user.findMany({
      where: {
        isActive: true,
        teamMemberships: {
          none: {
            teamId,
          },
        },
        ...(query.search && {
          OR: [
            {
              name: {
                contains: query.search.trim(),
              },
            },
            {
              email: {
                contains: query.search.trim(),
              },
            },
          ],
        }),
      },
      take: query.limit,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }
}
