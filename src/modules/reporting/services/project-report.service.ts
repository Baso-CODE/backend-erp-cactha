import {
  Prisma,
  ProjectServiceStatus,
  ProjectStatus,
  TaskStatus,
} from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { ProfitabilityService } from "../../profitability/profitability.service";
import { QueryProjectReportDTO } from "../dto/query-project-report.dto";

@injectable()
export class ProjectReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
    private readonly profitabilityService: ProfitabilityService,
  ) {}

  private async getReportWhere(
    query: QueryProjectReportDTO,
    actorId: string,
  ): Promise<Prisma.ProjectWhereInput> {
    const access = await this.getAccessWhere(actorId);
    const { from, toExclusive } = this.getDates(query);

    return {
      AND: [
        access,
        ...(query.search
          ? [
              {
                OR: [
                  { name: { contains: query.search } },
                  { projectCode: { contains: query.search } },
                ],
              },
            ]
          : []),
        ...(query.clientId ? [{ clientId: query.clientId }] : []),
        ...(query.projectManagerId
          ? [{ projectManagerId: query.projectManagerId }]
          : []),
        ...(query.status ? [{ status: query.status }] : []),
        ...(from || toExclusive
          ? [
              {
                createdAt: {
                  ...(from && { gte: from }),
                  ...(toExclusive && { lt: toExclusive }),
                },
              },
            ]
          : []),
      ],
    };
  }

  private async getFinancialAccessWhere(
    actorId: string,
  ): Promise<Prisma.ProjectWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "profitability.read",
    );

    if (scope === "ALL") return {};

    if (scope === "OWN" || scope === "PROJECT") {
      return { projectManagerId: actorId };
    }

    if (scope === "TEAM") {
      const memberIds = await this.accessScopeService.getTeamMemberIds(actorId);

      return {
        projectManagerId: { in: memberIds },
      };
    }

    throw new ApiError(
      `Scope ${scope} belum didukung untuk Financial Report.`,
      403,
    );
  }

  async getFinancial(query: QueryProjectReportDTO, actorId: string) {
    const projectWhere = await this.getReportWhere(query, actorId);
    const financialWhere = await this.getFinancialAccessWhere(actorId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.ProjectWhereInput = {
      AND: [projectWhere, financialWhere],
    };

    const [total, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          projectCode: true,
          name: true,
          status: true,
          client: {
            select: {
              id: true,
              companyName: true,
            },
          },
          projectManager: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const data = await Promise.all(
      projects.map(async (project) => {
        const profitability =
          await this.profitabilityService.getProjectProfitability(
            project.id,
            actorId,
          );

        return {
          project,
          currency: profitability.currency,
          ...profitability.summary,
        };
      }),
    );

    const zero = new Prisma.Decimal(0);

    type FinancialTotal = {
      totalBudget: Prisma.Decimal;
      actualCost: Prisma.Decimal;
      netRevenue: Prisma.Decimal;
      verifiedPayments: Prisma.Decimal;
    };

    const totals = new Map<string, FinancialTotal>();

    for (const item of data) {
      if (!item.currency) continue;

      const current = totals.get(item.currency) ?? {
        totalBudget: zero,
        actualCost: zero,
        netRevenue: zero,
        verifiedPayments: zero,
      };

      totals.set(item.currency, {
        totalBudget: current.totalBudget.plus(item.totalBudget),
        actualCost: current.actualCost.plus(item.actualCost),
        netRevenue: current.netRevenue.plus(item.netRevenue),
        verifiedPayments: current.verifiedPayments.plus(item.verifiedPayments),
      });
    }

    const pageSummary = [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, value]) => {
        const budgetVariance = value.totalBudget.minus(value.actualCost);

        const grossProfit = value.netRevenue.minus(value.actualCost);

        return {
          currency,
          totalBudget: value.totalBudget.toFixed(2),
          actualCost: value.actualCost.toFixed(2),
          budgetVariance: budgetVariance.toFixed(2),
          budgetUtilizationPercent: value.totalBudget.gt(0)
            ? value.actualCost.div(value.totalBudget).mul(100).toFixed(2)
            : null,
          netRevenue: value.netRevenue.toFixed(2),
          verifiedPayments: value.verifiedPayments.toFixed(2),
          grossProfit: grossProfit.toFixed(2),
          grossMarginPercent: value.netRevenue.gt(0)
            ? grossProfit.div(value.netRevenue).mul(100).toFixed(2)
            : null,
        };
      });

    return {
      filters: {
        search: query.search ?? null,
        clientId: query.clientId ?? null,
        projectManagerId: query.projectManagerId ?? null,
        status: query.status ?? null,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
      },
      data,
      pageSummary,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async getAccessWhere(actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "project.read",
    );

    if (scope === "ALL") return {};

    if (scope === "TEAM") {
      const members = await this.accessScopeService.getTeamMemberIds(actorId);
      return { projectManagerId: { in: members } };
    }

    if (scope === "OWN" || scope === "PROJECT") {
      return { projectManagerId: actorId };
    }

    throw new ApiError(
      `Scope ${scope} belum didukung untuk Project Report.`,
      403,
    );
  }

  private getDates(query: QueryProjectReportDTO) {
    const from = query.dateFrom
      ? new Date(`${query.dateFrom}T00:00:00.000Z`)
      : undefined;

    const to = query.dateTo
      ? new Date(`${query.dateTo}T00:00:00.000Z`)
      : undefined;

    if (
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime()))
    ) {
      throw new ApiError("Tanggal laporan tidak valid.", 400);
    }

    if (from && to && from > to) {
      throw new ApiError(
        "Tanggal awal tidak boleh melebihi tanggal akhir.",
        400,
      );
    }

    const toExclusive = to
      ? new Date(
          Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1),
        )
      : undefined;

    return { from, toExclusive };
  }

  async getOverview(query: QueryProjectReportDTO, actorId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where = await this.getReportWhere(query, actorId);

    const [total, statuses, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.project.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          projectCode: true,
          name: true,
          projectType: true,
          status: true,
          startDate: true,
          targetEndDate: true,
          actualEndDate: true,
          createdAt: true,
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
          projectManager: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              services: true,
              tasks: true,
              deliverables: true,
            },
          },
        },
      }),
    ]);

    const ids = projects.map((project) => project.id);

    const [taskStats, serviceStats] = ids.length
      ? await Promise.all([
          this.prisma.task.groupBy({
            by: ["projectId", "status"],
            where: { projectId: { in: ids } },
            _count: { _all: true },
          }),
          this.prisma.projectService.groupBy({
            by: ["projectId", "status"],
            where: { projectId: { in: ids } },
            _count: { _all: true },
          }),
        ])
      : [[], []];

    const taskMap = new Map<string, { total: number; completed: number }>();
    const serviceMap = new Map<
      string,
      { total: number; completed: number; cancelled: number }
    >();

    for (const item of taskStats) {
      const current = taskMap.get(item.projectId) ?? {
        total: 0,
        completed: 0,
      };

      current.total += item._count._all;

      if (item.status === TaskStatus.COMPLETED) {
        current.completed += item._count._all;
      }

      taskMap.set(item.projectId, current);
    }

    for (const item of serviceStats) {
      const current = serviceMap.get(item.projectId) ?? {
        total: 0,
        completed: 0,
        cancelled: 0,
      };

      current.total += item._count._all;

      if (item.status === ProjectServiceStatus.COMPLETED) {
        current.completed += item._count._all;
      }

      if (item.status === ProjectServiceStatus.CANCELLED) {
        current.cancelled += item._count._all;
      }

      serviceMap.set(item.projectId, current);
    }

    const percentage = (completed: number, total: number) =>
      total > 0 ? Math.round((completed / total) * 100) : 0;

    const statusCounts: Record<ProjectStatus, number> = {
      DRAFT: 0,
      PLANNING: 0,
      IN_PROGRESS: 0,
      INTERNAL_REVIEW: 0,
      PENDING_CLIENT_APPROVAL: 0,
      CLIENT_REVISION: 0,
      APPROVED: 0,
      COMPLETED: 0,
      ON_HOLD: 0,
      CANCELLED: 0,
    };

    for (const item of statuses) {
      statusCounts[item.status] = item._count._all;
    }

    const now = new Date();
    const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );

    return {
      filters: {
        search: query.search ?? null,
        clientId: query.clientId ?? null,
        projectManagerId: query.projectManagerId ?? null,
        status: query.status ?? null,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
      },
      summary: {
        totalProjects: total,
        completedProjects: statusCounts.COMPLETED,
        cancelledProjects: statusCounts.CANCELLED,
        inProgressProjects: statusCounts.IN_PROGRESS,
        statusCounts,
      },
      data: projects.map((project) => {
        const tasks = taskMap.get(project.id) ?? {
          total: 0,
          completed: 0,
        };

        const services = serviceMap.get(project.id) ?? {
          total: 0,
          completed: 0,
          cancelled: 0,
        };

        const activeServiceTotal = services.total - services.cancelled;

        const targetDate = Date.UTC(
          project.targetEndDate.getUTCFullYear(),
          project.targetEndDate.getUTCMonth(),
          project.targetEndDate.getUTCDate(),
        );

        const isOverdue =
          project.status !== ProjectStatus.COMPLETED &&
          project.status !== ProjectStatus.CANCELLED &&
          targetDate < today;
        return {
          ...project,
          taskProgress: {
            total: tasks.total,
            completed: tasks.completed,
            percentage: percentage(tasks.completed, tasks.total),
          },
          serviceProgress: {
            total: services.total,
            completed: services.completed,
            cancelled: services.cancelled,
            percentage: percentage(services.completed, activeServiceTotal),
          },
          isOverdue,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProgress(query: QueryProjectReportDTO, actorId: string) {
    const where = await this.getReportWhere(query, actorId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [total, projects, taskStats, serviceStats] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          projectCode: true,
          name: true,
          status: true,
          client: {
            select: {
              id: true,
              companyName: true,
            },
          },
          projectManager: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              tasks: true,
              services: true,
            },
          },
        },
      }),
      this.prisma.task.groupBy({
        by: ["status"],
        where: { project: where },
        _count: { _all: true },
      }),
      this.prisma.projectService.groupBy({
        by: ["status"],
        where: { project: where },
        _count: { _all: true },
      }),
    ]);

    const pageIds = projects.map((project) => project.id);

    const [pageTasks, pageServices] = pageIds.length
      ? await Promise.all([
          this.prisma.task.groupBy({
            by: ["projectId", "status"],
            where: { projectId: { in: pageIds } },
            _count: { _all: true },
          }),
          this.prisma.projectService.groupBy({
            by: ["projectId", "status"],
            where: { projectId: { in: pageIds } },
            _count: { _all: true },
          }),
        ])
      : [[], []];

    const taskCounts: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      BLOCKED: 0,
      COMPLETED: 0,
    };

    const serviceCounts: Record<ProjectServiceStatus, number> = {
      PLANNED: 0,
      ACTIVE: 0,
      PAUSED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const item of taskStats) {
      taskCounts[item.status] = item._count._all;
    }

    for (const item of serviceStats) {
      serviceCounts[item.status] = item._count._all;
    }

    const taskTotal = Object.values(taskCounts).reduce(
      (sum, value) => sum + value,
      0,
    );

    const serviceTotal = Object.values(serviceCounts).reduce(
      (sum, value) => sum + value,
      0,
    );

    const serviceEligible = serviceTotal - serviceCounts.CANCELLED;

    const percentage = (completed: number, totalItems: number) =>
      totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0;

    const taskMap = new Map<
      string,
      { total: number; completed: number; blocked: number }
    >();

    const serviceMap = new Map<
      string,
      { total: number; completed: number; cancelled: number }
    >();

    for (const item of pageTasks) {
      const current = taskMap.get(item.projectId) ?? {
        total: 0,
        completed: 0,
        blocked: 0,
      };

      current.total += item._count._all;

      if (item.status === TaskStatus.COMPLETED) {
        current.completed += item._count._all;
      }

      if (item.status === TaskStatus.BLOCKED) {
        current.blocked += item._count._all;
      }

      taskMap.set(item.projectId, current);
    }

    for (const item of pageServices) {
      const current = serviceMap.get(item.projectId) ?? {
        total: 0,
        completed: 0,
        cancelled: 0,
      };

      current.total += item._count._all;

      if (item.status === ProjectServiceStatus.COMPLETED) {
        current.completed += item._count._all;
      }

      if (item.status === ProjectServiceStatus.CANCELLED) {
        current.cancelled += item._count._all;
      }

      serviceMap.set(item.projectId, current);
    }

    return {
      summary: {
        totalProjects: total,
        tasks: {
          total: taskTotal,
          completed: taskCounts.COMPLETED,
          blocked: taskCounts.BLOCKED,
          percentage: percentage(taskCounts.COMPLETED, taskTotal),
          statusCounts: taskCounts,
        },
        services: {
          total: serviceTotal,
          eligible: serviceEligible,
          completed: serviceCounts.COMPLETED,
          cancelled: serviceCounts.CANCELLED,
          percentage: percentage(serviceCounts.COMPLETED, serviceEligible),
          statusCounts: serviceCounts,
        },
      },
      data: projects.map((project) => {
        const tasks = taskMap.get(project.id) ?? {
          total: 0,
          completed: 0,
          blocked: 0,
        };

        const services = serviceMap.get(project.id) ?? {
          total: 0,
          completed: 0,
          cancelled: 0,
        };

        return {
          ...project,
          taskProgress: {
            ...tasks,
            percentage: percentage(tasks.completed, tasks.total),
          },
          serviceProgress: {
            ...services,
            eligible: services.total - services.cancelled,
            percentage: percentage(
              services.completed,
              services.total - services.cancelled,
            ),
          },
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTimeline(query: QueryProjectReportDTO, actorId: string) {
    const where = await this.getReportWhere(query, actorId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const now = new Date();
    const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const dayMs = 24 * 60 * 60 * 1000;
    const dueSoonUntil = today + 7 * dayMs;

    const dateValue = (date: Date) =>
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

    type TimelineStatus =
      | "ON_TRACK"
      | "DUE_SOON"
      | "OVERDUE"
      | "COMPLETED_ON_TIME"
      | "COMPLETED_LATE"
      | "COMPLETED_UNKNOWN"
      | "CANCELLED";

    const getTimelineStatus = (project: {
      status: ProjectStatus;
      targetEndDate: Date;
      actualEndDate: Date | null;
    }): TimelineStatus => {
      if (project.status === ProjectStatus.CANCELLED) {
        return "CANCELLED";
      }

      if (project.status === ProjectStatus.COMPLETED) {
        if (!project.actualEndDate) return "COMPLETED_UNKNOWN";

        return dateValue(project.actualEndDate) <=
          dateValue(project.targetEndDate)
          ? "COMPLETED_ON_TIME"
          : "COMPLETED_LATE";
      }

      const deadline = dateValue(project.targetEndDate);

      if (deadline < today) return "OVERDUE";
      if (deadline <= dueSoonUntil) return "DUE_SOON";

      return "ON_TRACK";
    };

    const [total, allProjects, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        select: {
          status: true,
          targetEndDate: true,
          actualEndDate: true,
        },
      }),
      this.prisma.project.findMany({
        where,
        orderBy: [{ targetEndDate: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          projectCode: true,
          name: true,
          status: true,
          startDate: true,
          targetEndDate: true,
          actualEndDate: true,
          client: {
            select: {
              id: true,
              companyName: true,
            },
          },
          projectManager: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const statusCounts: Record<TimelineStatus, number> = {
      ON_TRACK: 0,
      DUE_SOON: 0,
      OVERDUE: 0,
      COMPLETED_ON_TIME: 0,
      COMPLETED_LATE: 0,
      COMPLETED_UNKNOWN: 0,
      CANCELLED: 0,
    };

    for (const project of allProjects) {
      statusCounts[getTimelineStatus(project)]++;
    }

    const completedWithDate =
      statusCounts.COMPLETED_ON_TIME + statusCounts.COMPLETED_LATE;

    return {
      asOfDate: new Date(today).toISOString().slice(0, 10),
      timezone: "UTC",
      summary: {
        totalProjects: total,
        statusCounts,
        overdueProjects: statusCounts.OVERDUE,
        dueSoonProjects: statusCounts.DUE_SOON,
        completedOnTime: statusCounts.COMPLETED_ON_TIME,
        completedLate: statusCounts.COMPLETED_LATE,
        completedWithoutActualDate: statusCounts.COMPLETED_UNKNOWN,
        onTimeCompletionRate:
          completedWithDate > 0
            ? Math.round(
                (statusCounts.COMPLETED_ON_TIME / completedWithDate) * 100,
              )
            : null,
      },
      data: projects.map((project) => {
        const timelineStatus = getTimelineStatus(project);
        const deadline = dateValue(project.targetEndDate);

        return {
          ...project,
          timelineStatus,
          daysUntilDeadline: Math.round((deadline - today) / dayMs),
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
