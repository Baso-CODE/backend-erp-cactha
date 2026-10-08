import { Prisma, RecurringBillingJobStatus } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";

type JobListQuery = {
  page: number;
  limit: number;
  status?: RecurringBillingJobStatus;
  recurringBillingId?: string;
};

@injectable()
export class RecurringBillingJobMonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private async getAccessFilter(
    actorId: string,
    permission = "recurring_billing.read",
  ) {
    const scope = await this.accessScope.getPermissionScope(
      actorId,
      permission,
    );

    const where: Prisma.RecurringBillingJobWhereInput =
      scope === "ALL"
        ? {}
        : {
            recurringBilling: {
              contract: {
                client: { accountManagerId: actorId },
              },
            },
          };

    return where;
  }

  async getJobs(query: JobListQuery, actorId: string) {
    const access = await this.getAccessFilter(actorId);

    const where: Prisma.RecurringBillingJobWhereInput = {
      AND: [
        access,
        {
          ...(query.status && { status: query.status }),
          ...(query.recurringBillingId && {
            recurringBillingId: query.recurringBillingId,
          }),
        },
      ],
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.recurringBillingJob.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          recurringBilling: {
            select: {
              id: true,
              frequency: true,
              contract: {
                select: {
                  contractNo: true,
                  title: true,
                  client: {
                    select: {
                      id: true,
                      companyName: true,
                    },
                  },
                },
              },
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.recurringBillingJob.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getSummary(actorId: string) {
    const access = await this.getAccessFilter(actorId);

    const [
      pending,
      processing,
      completed,
      failed,
      terminalFailed,
      retryScheduled,
    ] = await this.prisma.$transaction([
      this.prisma.recurringBillingJob.count({
        where: {
          AND: [access, { status: "PENDING" }],
        },
      }),
      this.prisma.recurringBillingJob.count({
        where: {
          AND: [access, { status: "PROCESSING" }],
        },
      }),
      this.prisma.recurringBillingJob.count({
        where: {
          AND: [access, { status: "COMPLETED" }],
        },
      }),
      this.prisma.recurringBillingJob.count({
        where: {
          AND: [access, { status: "FAILED" }],
        },
      }),
      this.prisma.recurringBillingJob.count({
        where: {
          AND: [access, { status: "FAILED", nextRetryAt: null }],
        },
      }),
      this.prisma.recurringBillingJob.count({
        where: {
          AND: [access, { status: "FAILED", nextRetryAt: { not: null } }],
        },
      }),
    ]);

    return {
      PENDING: pending,
      PROCESSING: processing,
      COMPLETED: completed,
      FAILED: failed,
      terminalFailed,
      retryScheduled,
      total: pending + processing + completed + failed,
    };
  }

  async retryJob(jobId: string, actorId: string) {
    const access = await this.getAccessFilter(
      actorId,
      "recurring_billing.update",
    );

    return this.prisma.$transaction(async (tx) => {
      const job = await tx.recurringBillingJob.findFirst({
        where: {
          AND: [{ id: jobId }, access],
        },
        include: {
          recurringBilling: {
            include: {
              contract: {
                select: {
                  status: true,
                  startDate: true,
                  endDate: true,
                },
              },
            },
          },
        },
      });

      if (!job) {
        throw new ApiError(
          "Job tidak ditemukan atau tidak memiliki akses.",
          404,
        );
      }

      if (job.status !== "FAILED" || job.nextRetryAt !== null) {
        throw new ApiError(
          "Hanya job yang gagal permanen yang dapat di-retry manual.",
          409,
        );
      }

      const existingInvoice = await tx.invoice.findFirst({
        where: {
          recurringBillingId: job.recurringBillingId,
          billingPeriodStart: job.billingPeriodStart,
        },
        select: { id: true, invoiceNo: true },
      });

      if (existingInvoice) {
        const reconciled = await tx.recurringBillingJob.updateMany({
          where: {
            id: job.id,
            status: "FAILED",
            nextRetryAt: null,
            updatedAt: job.updatedAt,
          },
          data: {
            status: "COMPLETED",
            invoiceId: existingInvoice.id,
            completedAt: new Date(),
            lastError: null,
            lockedBy: null,
            lockedUntil: null,
          },
        });

        if (reconciled.count !== 1) {
          throw new ApiError("Status job sudah berubah. Muat ulang data.", 409);
        }

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "RECONCILE",
            entity: "RecurringBillingJob",
            entityId: job.id,
            details: {
              invoiceId: existingInvoice.id,
              invoiceNo: existingInvoice.invoiceNo,
              source: "MANUAL_RETRY",
            },
          },
        });

        return {
          status: "COMPLETED" as const,
          jobId: job.id,
          invoiceId: existingInvoice.id,
          message: "Invoice sudah tersedia. Job berhasil direkonsiliasi.",
        };
      }

      const billing = job.recurringBilling;
      const period = job.billingPeriodStart;

      if (
        !billing.isActive ||
        billing.contract.status !== "ACTIVE" ||
        period < billing.contract.startDate ||
        period > billing.contract.endDate ||
        period > new Date() ||
        billing.nextRunDate.getTime() !== period.getTime()
      ) {
        throw new ApiError(
          "Job tidak bisa di-retry karena konfigurasi billing atau kontrak sudah berubah.",
          409,
        );
      }

      const retried = await tx.recurringBillingJob.updateMany({
        where: {
          id: job.id,
          status: "FAILED",
          nextRetryAt: null,
          updatedAt: job.updatedAt,
        },
        data: {
          status: "PENDING",
          attempts: 0,
          nextRetryAt: null,
          lastError: null,
          lockedBy: null,
          lockedUntil: null,
          startedAt: null,
          completedAt: null,
        },
      });

      if (retried.count !== 1) {
        throw new ApiError("Status job sudah berubah. Muat ulang data.", 409);
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "RETRY",
          entity: "RecurringBillingJob",
          entityId: job.id,
          details: {
            recurringBillingId: job.recurringBillingId,
            billingPeriodStart: period.toISOString(),
            previousAttempts: job.attempts,
            source: "MANUAL",
          },
        },
      });

      return {
        status: "PENDING" as const,
        jobId: job.id,
        message: "Job masuk kembali ke antrean pemrosesan.",
      };
    });
  }
}
