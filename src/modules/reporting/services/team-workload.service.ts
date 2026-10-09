import { AccessScope, Priority, Prisma, TaskStatus } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import {
  QueryTeamWorkloadDTO,
  QueryTeamWorkloadIssuesDTO,
  WorkloadIssueType,
} from "../dto/query-team-workload.dto";

type StatusCounts = Record<TaskStatus, number>;
type PriorityCounts = Record<Priority, number>;

const EMPTY_STATUS_COUNTS = (): StatusCounts => ({
  TODO: 0,
  IN_PROGRESS: 0,
  REVIEW: 0,
  BLOCKED: 0,
  COMPLETED: 0,
});

const EMPTY_PRIORITY_COUNTS = (): PriorityCounts => ({
  LOW: 0,
  MEDIUM: 0,
  HIGH: 0,
});

function getTodayUtc() {
  const now = new Date();

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function pagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

@injectable()
export class TeamWorkloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async getAccessWhere(
    actorId: string,
  ): Promise<Prisma.TaskWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "task.read",
    );

    switch (scope) {
      case AccessScope.ALL:
        return {};

      case AccessScope.OWN:
        return { assigneeId: actorId };

      case AccessScope.TEAM: {
        const memberIds =
          await this.accessScopeService.getTeamMemberIds(actorId);

        return {
          assigneeId: { in: memberIds },
        };
      }

      case AccessScope.PROJECT:
        return {
          project: {
            projectManagerId: actorId,
          },
        };

      default:
        throw new ApiError(
          `Scope ${scope} belum didukung untuk Team Workload.`,
          403,
        );
    }
  }

  private async buildWhere(
    query: QueryTeamWorkloadDTO,
    actorId: string,
  ): Promise<Prisma.TaskWhereInput> {
    const access = await this.getAccessWhere(actorId);

    return {
      AND: [
        access,
        ...(query.projectId ? [{ projectId: query.projectId }] : []),
        ...(query.assigneeId ? [{ assigneeId: query.assigneeId }] : []),
      ],
    };
  }

  private getIssueFilters(today: Date) {
    const dueSoonExclusive = addUtcDays(today, 8);

    const unfinished: Prisma.TaskWhereInput = {
      status: { not: TaskStatus.COMPLETED },
    };

    const overdue: Prisma.TaskWhereInput = {
      AND: [unfinished, { dueDate: { lt: today } }],
    };

    const blocked: Prisma.TaskWhereInput = {
      status: TaskStatus.BLOCKED,
    };

    const dueSoon: Prisma.TaskWhereInput = {
      AND: [
        unfinished,
        {
          dueDate: {
            gte: today,
            lt: dueSoonExclusive,
          },
        },
      ],
    };

    const highPriority: Prisma.TaskWhereInput = {
      AND: [unfinished, { priority: Priority.HIGH }],
    };

    return {
      overdue,
      blocked,
      dueSoon,
      highPriority,
    };
  }

  async getOverview(query: QueryTeamWorkloadDTO, actorId: string) {
    const where = await this.buildWhere(query, actorId);
    const today = getTodayUtc();
    const issues = this.getIssueFilters(today);

    const [
      statusGroups,
      overdueTasks,
      dueSoonTasks,
      highPriorityTasks,
      unassignedTasks,
      assigneeGroups,
      projectGroups,
    ] = await Promise.all([
      this.prisma.task.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.task.count({
        where: { AND: [where, issues.overdue] },
      }),
      this.prisma.task.count({
        where: { AND: [where, issues.dueSoon] },
      }),
      this.prisma.task.count({
        where: { AND: [where, issues.highPriority] },
      }),
      this.prisma.task.count({
        where: {
          AND: [where, { assigneeId: null }],
        },
      }),
      this.prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          AND: [where, { assigneeId: { not: null } }],
        },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ["projectId"],
        where,
        _count: { _all: true },
      }),
    ]);

    const statusCounts = EMPTY_STATUS_COUNTS();

    for (const item of statusGroups) {
      statusCounts[item.status] = item._count._all;
    }

    const totalTasks = Object.values(statusCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    const completedTasks = statusCounts.COMPLETED;
    const activeTasks = totalTasks - completedTasks;

    return {
      asOfDate: today.toISOString().slice(0, 10),
      timezone: "UTC",
      filters: {
        projectId: query.projectId ?? null,
        assigneeId: query.assigneeId ?? null,
      },
      summary: {
        totalTasks,
        activeTasks,
        completedTasks,
        blockedTasks: statusCounts.BLOCKED,
        overdueTasks,
        dueSoonTasks,
        highPriorityTasks,
        unassignedTasks,
        totalAssignees: assigneeGroups.length,
        totalProjects: projectGroups.length,
        completionRate:
          totalTasks > 0
            ? Math.round((completedTasks / totalTasks) * 100)
            : null,
        statusCounts,
      },
    };
  }

  async getAssignees(query: QueryTeamWorkloadDTO, actorId: string) {
    const where = await this.buildWhere(query, actorId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const today = getTodayUtc();
    const issues = this.getIssueFilters(today);

    const assignedWhere: Prisma.TaskWhereInput = {
      AND: [where, { assigneeId: { not: null } }],
    };

    const [allGroups, activeGroups] = await Promise.all([
      this.prisma.task.groupBy({
        by: ["assigneeId"],
        where: assignedWhere,
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          AND: [assignedWhere, { status: { not: TaskStatus.COMPLETED } }],
        },
        _count: { _all: true },
      }),
    ]);

    const activeMap = new Map(
      activeGroups
        .filter((item) => item.assigneeId !== null)
        .map((item) => [item.assigneeId as string, item._count._all]),
    );

    const ranking = allGroups
      .filter(
        (item): item is typeof item & { assigneeId: string } =>
          item.assigneeId !== null,
      )
      .map((item) => ({
        id: item.assigneeId,
        totalTasks: item._count._all,
        activeTasks: activeMap.get(item.assigneeId) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.activeTasks - a.activeTasks ||
          b.totalTasks - a.totalTasks ||
          a.id.localeCompare(b.id),
      );

    const total = ranking.length;
    const selected = ranking.slice((page - 1) * limit, page * limit);
    const ids = selected.map((item) => item.id);

    const totalAssignedTasks = ranking.reduce(
      (sum, item) => sum + item.totalTasks,
      0,
    );
    const totalActiveTasks = ranking.reduce(
      (sum, item) => sum + item.activeTasks,
      0,
    );

    if (!ids.length) {
      return {
        asOfDate: today.toISOString().slice(0, 10),
        timezone: "UTC",
        filters: {
          projectId: query.projectId ?? null,
          assigneeId: query.assigneeId ?? null,
        },
        sort: "ACTIVE_TASKS_DESC",
        summary: {
          totalAssignees: total,
          totalAssignedTasks,
          totalActiveTasks,
        },
        data: [],
        meta: pagination(page, limit, total),
      };
    }

    const pageWhere: Prisma.TaskWhereInput = {
      AND: [assignedWhere, { assigneeId: { in: ids } }],
    };

    const [users, statusGroups, priorityGroups, overdueGroups, dueSoonGroups] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        }),
        this.prisma.task.groupBy({
          by: ["assigneeId", "status"],
          where: pageWhere,
          _count: { _all: true },
        }),
        this.prisma.task.groupBy({
          by: ["assigneeId", "priority"],
          where: pageWhere,
          _count: { _all: true },
        }),
        this.prisma.task.groupBy({
          by: ["assigneeId"],
          where: {
            AND: [pageWhere, issues.overdue],
          },
          _count: { _all: true },
        }),
        this.prisma.task.groupBy({
          by: ["assigneeId"],
          where: {
            AND: [pageWhere, issues.dueSoon],
          },
          _count: { _all: true },
        }),
      ]);

    const userMap = new Map(users.map((user) => [user.id, user]));
    const statusMap = new Map<string, StatusCounts>();
    const priorityMap = new Map<string, PriorityCounts>();

    for (const item of statusGroups) {
      if (!item.assigneeId) continue;
      const counts = statusMap.get(item.assigneeId) ?? EMPTY_STATUS_COUNTS();

      counts[item.status] = item._count._all;
      statusMap.set(item.assigneeId, counts);
    }

    for (const item of priorityGroups) {
      if (!item.assigneeId) continue;
      const counts =
        priorityMap.get(item.assigneeId) ?? EMPTY_PRIORITY_COUNTS();

      counts[item.priority] = item._count._all;
      priorityMap.set(item.assigneeId, counts);
    }

    const overdueMap = new Map(
      overdueGroups
        .filter((item) => item.assigneeId !== null)
        .map((item) => [item.assigneeId as string, item._count._all]),
    );

    const dueSoonMap = new Map(
      dueSoonGroups
        .filter((item) => item.assigneeId !== null)
        .map((item) => [item.assigneeId as string, item._count._all]),
    );

    const data = selected.map((item, index) => {
      const statuses = statusMap.get(item.id) ?? EMPTY_STATUS_COUNTS();
      const priorities = priorityMap.get(item.id) ?? EMPTY_PRIORITY_COUNTS();

      return {
        rank: (page - 1) * limit + index + 1,
        assignee: userMap.get(item.id) ?? {
          id: item.id,
          name: "Unknown User",
          email: "",
          isActive: false,
        },
        totalTasks: item.totalTasks,
        activeTasks: item.activeTasks,
        completedTasks: statuses.COMPLETED,
        blockedTasks: statuses.BLOCKED,
        overdueTasks: overdueMap.get(item.id) ?? 0,
        dueSoonTasks: dueSoonMap.get(item.id) ?? 0,
        completionRate:
          item.totalTasks > 0
            ? Math.round((statuses.COMPLETED / item.totalTasks) * 100)
            : null,
        statusCounts: statuses,
        priorityCounts: priorities,
      };
    });

    return {
      asOfDate: today.toISOString().slice(0, 10),
      timezone: "UTC",
      filters: {
        projectId: query.projectId ?? null,
        assigneeId: query.assigneeId ?? null,
      },
      sort: "ACTIVE_TASKS_DESC",
      summary: {
        totalAssignees: total,
        totalAssignedTasks,
        totalActiveTasks,
      },
      data,
      meta: pagination(page, limit, total),
    };
  }

  async getIssues(query: QueryTeamWorkloadIssuesDTO, actorId: string) {
    const where = await this.buildWhere(query, actorId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const today = getTodayUtc();
    const rules = this.getIssueFilters(today);
    const issueType = query.issueType ?? WorkloadIssueType.ALL;

    const issueWhere: Record<WorkloadIssueType, Prisma.TaskWhereInput> = {
      ALL: {
        OR: [rules.overdue, rules.blocked, rules.dueSoon, rules.highPriority],
      },
      OVERDUE: rules.overdue,
      BLOCKED: rules.blocked,
      DUE_SOON: rules.dueSoon,
      HIGH_PRIORITY: rules.highPriority,
    };

    const filteredWhere: Prisma.TaskWhereInput = {
      AND: [where, issueWhere[issueType]],
    };

    const [
      total,
      overdueCount,
      blockedCount,
      dueSoonCount,
      highPriorityCount,
      tasks,
    ] = await Promise.all([
      this.prisma.task.count({
        where: filteredWhere,
      }),
      this.prisma.task.count({
        where: { AND: [where, rules.overdue] },
      }),
      this.prisma.task.count({
        where: { AND: [where, rules.blocked] },
      }),
      this.prisma.task.count({
        where: { AND: [where, rules.dueSoon] },
      }),
      this.prisma.task.count({
        where: { AND: [where, rules.highPriority] },
      }),
      this.prisma.task.findMany({
        where: filteredWhere,
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          taskCode: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          startDate: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const todayMs = today.getTime();
    const dayMs = 86400000;

    const data = tasks.map((task) => {
      const dueDay = task.dueDate
        ? Date.UTC(
            task.dueDate.getUTCFullYear(),
            task.dueDate.getUTCMonth(),
            task.dueDate.getUTCDate(),
          )
        : null;

      const daysUntilDue =
        dueDay !== null ? Math.round((dueDay - todayMs) / dayMs) : null;

      const unfinished = task.status !== TaskStatus.COMPLETED;

      const tags: WorkloadIssueType[] = [];

      if (unfinished && daysUntilDue !== null && daysUntilDue < 0) {
        tags.push(WorkloadIssueType.OVERDUE);
      }

      if (task.status === TaskStatus.BLOCKED) {
        tags.push(WorkloadIssueType.BLOCKED);
      }

      if (
        unfinished &&
        daysUntilDue !== null &&
        daysUntilDue >= 0 &&
        daysUntilDue <= 7
      ) {
        tags.push(WorkloadIssueType.DUE_SOON);
      }

      if (unfinished && task.priority === Priority.HIGH) {
        tags.push(WorkloadIssueType.HIGH_PRIORITY);
      }

      return {
        ...task,
        daysUntilDue,
        primaryIssue: tags[0] ?? null,
        issueTags: tags,
      };
    });

    return {
      asOfDate: today.toISOString().slice(0, 10),
      timezone: "UTC",
      filters: {
        projectId: query.projectId ?? null,
        assigneeId: query.assigneeId ?? null,
        issueType,
      },
      summary: {
        totalIssues: total,
        overdueTasks: overdueCount,
        blockedTasks: blockedCount,
        dueSoonTasks: dueSoonCount,
        highPriorityTasks: highPriorityCount,
      },
      data,
      meta: pagination(page, limit, total),
    };
  }
}
