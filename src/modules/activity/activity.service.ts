// activity.service.ts

import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { UserAccessService } from "../../helpers/user-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateActivityDTO } from "./dto/create-activity.dto";
import { QueryActivityDTO } from "./dto/query-activity.dto";
import { UpdateActivityDTO } from "./dto/update-activity.dto";

@injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
    private readonly userAccessService: UserAccessService,
  ) {}

  async getAllActivities(query: QueryActivityDTO, actorId: string) {
    const {
      leadId,
      type,
      status,
      performedById,
      search,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.activity.read",
    );

    const accessFilter: Prisma.ActivityWhereInput =
      scope === "ALL"
        ? {}
        : {
            lead: {
              assigneeId: actorId,
            },
          };

    const where: Prisma.ActivityWhereInput = {
      AND: [
        accessFilter,
        {
          ...(leadId && { leadId }),
          ...(type && { type }),
          ...(status && { status }),
          ...(performedById && { performedById }),
          ...(search && {
            OR: [
              { subject: { contains: search } },
              { description: { contains: search } },
              { result: { contains: search } },
              {
                lead: {
                  company: {
                    contains: search,
                  },
                },
              },
            ],
          }),
        },
      ],
    };

    const [activities, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          activityDate: "desc",
        },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              company: true,
              pic: true,
              status: true,
            },
          },
          performedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getActivityById(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.activity.read",
    );

    const activity = await this.prisma.activity.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          lead: {
            assigneeId: actorId,
          },
        }),
      },
      include: {
        lead: {
          select: {
            id: true,
            leadCode: true,
            company: true,
            pic: true,
            status: true,
          },
        },
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!activity) {
      throw new Error("Activity tidak ditemukan atau tidak dapat diakses.");
    }

    return activity;
  }

  async createActivity(data: CreateActivityDTO, actorId: string) {
    await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.activity.create",
    );

    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          leadId: data.leadId,
          type: data.type,
          subject: data.subject,
          description: data.description,
          result: data.result,
          activityDate: new Date(data.activityDate),
          nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
          status: data.status,
          performedById: actorId,
        },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              company: true,
            },
          },
          performedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (data.nextFollowUp) {
        await tx.activity.create({
          data: {
            leadId: data.leadId,
            type: data.type,
            subject: `Follow Up: ${data.subject}`,
            description: `Follow up dari activity ${activity.id}`,
            activityDate: new Date(data.nextFollowUp),
            status: "SCHEDULED",
            performedById: actorId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Activity",
          entityId: activity.id,
          details: {
            leadId: activity.leadId,
            type: activity.type,
            subject: activity.subject,
            status: activity.status,
            activityDate: activity.activityDate,
            nextFollowUp: activity.nextFollowUp,
          },
        },
      });

      return activity;
    });
  }

  async updateActivity(id: string, data: UpdateActivityDTO, actorId: string) {
    const existing = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Activity tidak ditemukan.");
    }

    await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.activity.update",
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.activity.update({
        where: { id },
        data: {
          ...(data.type !== undefined && { type: data.type }),
          ...(data.subject !== undefined && { subject: data.subject }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.result !== undefined && { result: data.result }),
          ...(data.activityDate !== undefined && {
            activityDate: new Date(data.activityDate),
          }),
          ...(data.nextFollowUp !== undefined && {
            nextFollowUp: data.nextFollowUp
              ? new Date(data.nextFollowUp)
              : null,
          }),
          ...(data.status !== undefined && { status: data.status }),
        },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              company: true,
            },
          },
          performedBy: {
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
          entity: "Activity",
          entityId: id,
          details: {
            before: {
              type: existing.type,
              subject: existing.subject,
              description: existing.description,
              result: existing.result,
              activityDate: existing.activityDate,
              nextFollowUp: existing.nextFollowUp,
              status: existing.status,
            },
            after: {
              type: updated.type,
              subject: updated.subject,
              description: updated.description,
              result: updated.result,
              activityDate: updated.activityDate,
              nextFollowUp: updated.nextFollowUp,
              status: updated.status,
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteActivity(id: string, actorId: string) {
    const existing = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Activity tidak ditemukan.");
    }

    await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.activity.delete",
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.activity.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Activity",
          entityId: id,
          details: {
            leadId: existing.leadId,
            type: existing.type,
            subject: existing.subject,
            status: existing.status,
          },
        },
      });
    });

    return {
      message: `Activity "${existing.subject}" berhasil dihapus.`,
    };
  }
}
