import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";

type RenewalFilter = "ALL" | "UPCOMING" | "EXPIRED";

type RenewalQuery = {
  days?: number;
  page?: number;
  limit?: number;
  filter?: RenewalFilter;
};

const DAY_MS = 86400000;

@injectable()
export class ContractRenewalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: AccessScopeService,
  ) {}

  private getToday(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  async getOverview(actorId: string, query: RenewalQuery = {}) {
    const scope = await this.scopes.getPermissionScope(
      actorId,
      "contract.read",
    );

    if (scope !== "ALL" && scope !== "OWN") {
      throw new ApiError(
        "Scope contract.read tidak mendukung akses renewal.",
        403,
      );
    }

    const days = query.days ?? 30;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = query.filter ?? "ALL";

    if (
      !Number.isInteger(days) ||
      days < 1 ||
      days > 365 ||
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !["ALL", "UPCOMING", "EXPIRED"].includes(filter)
    ) {
      throw new ApiError("Parameter Renewal tidak valid.", 400);
    }

    const today = this.getToday();
    const tomorrow = new Date(today.getTime() + DAY_MS);
    const cutoff = new Date(today.getTime() + (days + 1) * DAY_MS);

    const accessWhere: Prisma.ContractWhereInput =
      scope === "ALL" ? {} : { client: { accountManagerId: actorId } };

    const baseWhere: Prisma.ContractWhereInput = {
      AND: [accessWhere, { status: { in: ["ACTIVE", "EXPIRED"] } }],
    };

    const expiredWhere: Prisma.ContractWhereInput = {
      AND: [baseWhere, { endDate: { lt: today } }],
    };

    const upcomingWhere: Prisma.ContractWhereInput = {
      AND: [
        baseWhere,
        {
          endDate: {
            gte: today,
            lt: cutoff,
          },
        },
      ],
    };

    const selectedWhere: Prisma.ContractWhereInput =
      filter === "EXPIRED"
        ? expiredWhere
        : filter === "UPCOMING"
          ? upcomingWhere
          : {
              AND: [baseWhere, { endDate: { lt: cutoff } }],
            };

    const [contracts, total, expired, upcoming] =
      await this.prisma.$transaction([
        this.prisma.contract.findMany({
          where: selectedWhere,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ endDate: "asc" }, { id: "asc" }],
          select: {
            id: true,
            contractNo: true,
            title: true,
            clientId: true,
            startDate: true,
            endDate: true,
            status: true,
            renewalReminder: true,
            value: true,
            currency: true,
            client: {
              select: {
                id: true,
                clientCode: true,
                companyName: true,
              },
            },
          },
        }),
        this.prisma.contract.count({
          where: selectedWhere,
        }),
        this.prisma.contract.count({
          where: expiredWhere,
        }),
        this.prisma.contract.count({
          where: upcomingWhere,
        }),
      ]);

    return {
      summary: {
        expired,
        upcoming,
        requiresAttention: expired + upcoming,
        windowDays: days,
      },
      data: contracts.map((contract) => {
        const endDate = new Date(
          Date.UTC(
            contract.endDate.getUTCFullYear(),
            contract.endDate.getUTCMonth(),
            contract.endDate.getUTCDate(),
          ),
        );

        const daysRemaining = Math.round(
          (endDate.getTime() - today.getTime()) / DAY_MS,
        );

        return {
          ...contract,
          value: contract.value.toString(),
          daysRemaining,
          renewalStatus: daysRemaining < 0 ? "EXPIRED" : "UPCOMING",
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
