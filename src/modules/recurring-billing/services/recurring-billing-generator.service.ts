import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";

type BillingJobContext = {
  jobId: string;
  workerId: string;
  billingPeriodStart: Date;
};

@injectable()
export class RecurringBillingGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  private getNextRunDate(
    date: Date,
    frequency: string,
    anchorDay: number,
  ): Date {
    const months: Record<string, number> = {
      MONTHLY: 1,
      QUARTERLY: 3,
      SEMIANNUALLY: 6,
      ANNUALLY: 12,
    };

    const increment = months[frequency];

    if (
      !increment ||
      !Number.isInteger(anchorDay) ||
      anchorDay < 1 ||
      anchorDay > 31
    ) {
      throw new ApiError(
        "Frekuensi atau tanggal acuan billing tidak valid.",
        400,
      );
    }

    const target = new Date(date);

    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + increment);

    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();

    target.setUTCDate(Math.min(anchorDay, lastDay));

    return target;
  }

  async generateInvoice(billingId: string, jobContext?: BillingJobContext) {
    return this.prisma.$transaction(
      async (tx) => {
        if (jobContext) {
          const now = new Date();

          const claim = await tx.recurringBillingJob.updateMany({
            where: {
              id: jobContext.jobId,
              recurringBillingId: billingId,
              billingPeriodStart: jobContext.billingPeriodStart,
              status: "PROCESSING",
              lockedBy: jobContext.workerId,
              lockedUntil: { gt: now },
            },
            data: {
              lockedUntil: new Date(now.getTime() + 60_000),
            },
          });

          if (claim.count !== 1) {
            throw new ApiError(
              "Hak pemrosesan job sudah kedaluwarsa atau berpindah.",
              409,
            );
          }
        }

        const billing = await tx.recurringBilling.findUnique({
          where: { id: billingId },
          include: {
            contract: {
              select: {
                id: true,
                clientId: true,
                contractNo: true,
                title: true,
                currency: true,
                status: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        });

        if (!billing) {
          throw new ApiError("Recurring billing tidak ditemukan.", 404);
        }

        if (!billing.isActive || billing.contract.status !== "ACTIVE") {
          throw new ApiError("Recurring billing tidak aktif.", 400);
        }

        const periodStart = billing.nextRunDate;
        const now = new Date();

        if (periodStart > now) {
          throw new ApiError("Jadwal billing belum jatuh tempo.", 400);
        }

        if (
          periodStart < billing.contract.startDate ||
          periodStart > billing.contract.endDate
        ) {
          throw new ApiError("Jadwal berada di luar periode kontrak.", 400);
        }

        const anchorDay = billing.billingAnchorDay;

        if (anchorDay === null) {
          throw new ApiError(
            "Tanggal acuan billing belum tersedia. Perbarui konfigurasi jadwal.",
            409,
          );
        }

        const nextRunDate = this.getNextRunDate(
          periodStart,
          billing.frequency,
          anchorDay,
        );

        const dueDate = new Date(periodStart);
        dueDate.setUTCDate(dueDate.getUTCDate() + billing.dueDays);

        // Claim satu siklus secara atomik.
        const claim = await tx.recurringBilling.updateMany({
          where: {
            id: billing.id,
            isActive: true,
            nextRunDate: periodStart,
            contract: { status: "ACTIVE" },
          },
          data: {
            nextRunDate,
            lastRunDate: periodStart,
          },
        });

        if (claim.count !== 1) {
          throw new ApiError("Siklus billing sedang atau sudah diproses.", 409);
        }

        const year = periodStart.getUTCFullYear();

        const counter = await tx.counter.upsert({
          where: { key: `INVOICE_${year}` },
          update: { value: { increment: 1 } },
          create: { key: `INVOICE_${year}`, value: 1 },
        });

        const invoiceNo = `INV-${year}-${String(counter.value).padStart(6, "0")}`;

        const invoice = await tx.invoice.create({
          data: {
            invoiceNo,
            clientId: billing.contract.clientId,
            contractId: billing.contractId,
            recurringBillingId: billing.id,
            billingPeriodStart: periodStart,
            invoiceDate: periodStart,
            dueDate,
            currency: billing.currency,
            subtotal: billing.amount,
            discountAmount: new Prisma.Decimal(0),
            taxAmount: new Prisma.Decimal(0),
            totalAmount: billing.amount,
            status: "DRAFT",
            notes: `Recurring billing kontrak ${billing.contract.contractNo}`,
            items: {
              create: {
                description: `Recurring billing - ${billing.contract.title}`,
                quantity: new Prisma.Decimal(1),
                unitPrice: billing.amount,
                lineTotal: billing.amount,
                position: 0,
              },
            },
          },
          include: {
            items: true,
          },
        });

        await tx.auditLog.create({
          data: {
            action: "GENERATE",
            entity: "Invoice",
            entityId: invoice.id,
            details: {
              invoiceNo: invoice.invoiceNo,
              recurringBillingId: billing.id,
              contractId: billing.contractId,
              billingPeriodStart: periodStart.toISOString(),
              amount: billing.amount.toString(),
              nextRunDate: nextRunDate.toISOString(),
              source: "RECURRING_BILLING",
            },
          },
        });

        if (jobContext) {
          const completed = await tx.recurringBillingJob.updateMany({
            where: {
              id: jobContext.jobId,
              status: "PROCESSING",
              lockedBy: jobContext.workerId,
              recurringBillingId: billingId,
              billingPeriodStart: periodStart,
            },
            data: {
              status: "COMPLETED",
              invoiceId: invoice.id,
              completedAt: new Date(),
              nextRetryAt: null,
              lastError: null,
              lockedBy: null,
              lockedUntil: null,
            },
          });

          if (completed.count !== 1) {
            throw new ApiError("Gagal menyelesaikan job billing.", 409);
          }
        }

        return invoice;
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );
  }
}
