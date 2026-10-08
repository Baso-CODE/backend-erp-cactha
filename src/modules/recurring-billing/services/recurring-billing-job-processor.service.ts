import { injectable } from "tsyringe";
import { PrismaService } from "../../prisma/prisma.service";
import { RecurringBillingGeneratorService } from "./recurring-billing-generator.service";
import { RecurringBillingJobService } from "./recurring-billing-job.service";

const MAX_BACKOFF_MINUTES = 60;

@injectable()
export class RecurringBillingJobProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: RecurringBillingJobService,
    private readonly generatorService: RecurringBillingGeneratorService,
  ) {}

  private getRetryDate(attempts: number, now: Date): Date {
    const minutes = Math.min(
      2 ** Math.max(0, attempts - 1),
      MAX_BACKOFF_MINUTES,
    );

    return new Date(now.getTime() + minutes * 60_000);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private async findGeneratedInvoice(
    recurringBillingId: string,
    billingPeriodStart: Date,
  ) {
    return this.prisma.invoice.findFirst({
      where: {
        recurringBillingId,
        billingPeriodStart,
      },
      select: {
        id: true,
        invoiceNo: true,
      },
    });
  }

  private async completeJob(
    jobId: string,
    workerId: string,
    invoiceId: string,
  ): Promise<boolean> {
    const result = await this.prisma.recurringBillingJob.updateMany({
      where: {
        id: jobId,
        status: "PROCESSING",
        lockedBy: workerId,
        lockedUntil: { gt: new Date() },
      },
      data: {
        status: "COMPLETED",
        invoiceId,
        completedAt: new Date(),
        nextRetryAt: null,
        lastError: null,
        lockedBy: null,
        lockedUntil: null,
      },
    });

    return result.count === 1;
  }

  private async failJob(
    jobId: string,
    workerId: string,
    attempts: number,
    maxRetries: number,
    error: unknown,
    permanent = false,
  ): Promise<void> {
    const now = new Date();
    const exhausted = permanent || attempts >= maxRetries;

    await this.prisma.recurringBillingJob.updateMany({
      where: {
        id: jobId,
        status: "PROCESSING",
        lockedBy: workerId,
        lockedUntil: { gt: now },
      },
      data: {
        status: "FAILED",
        lastError: this.getErrorMessage(error).slice(0, 2000),
        nextRetryAt: exhausted ? null : this.getRetryDate(attempts, now),
        lockedBy: null,
        lockedUntil: null,
      },
    });
  }

  async processNextJob(workerId: string) {
    const job = await this.jobService.claimNextJob(workerId);

    if (!job) {
      return { status: "EMPTY" as const };
    }

    try {
      const existingInvoice = await this.findGeneratedInvoice(
        job.recurringBillingId,
        job.billingPeriodStart,
      );

      if (existingInvoice) {
        const completed = await this.completeJob(
          job.id,
          workerId,
          existingInvoice.id,
        );

        return {
          status: completed ? ("COMPLETED" as const) : ("LOCK_LOST" as const),
          jobId: job.id,
          invoiceId: existingInvoice.id,
        };
      }

      const billing = await this.prisma.recurringBilling.findUnique({
        where: { id: job.recurringBillingId },
        select: {
          id: true,
          isActive: true,
          nextRunDate: true,
          contract: {
            select: {
              status: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      });

      if (!billing) {
        await this.failJob(
          job.id,
          workerId,
          job.attempts,
          job.maxRetries,
          new Error("Recurring billing tidak ditemukan."),
          true,
        );

        return { status: "FAILED" as const, jobId: job.id };
      }

      const period = job.billingPeriodStart;

      if (
        !billing.isActive ||
        billing.contract.status !== "ACTIVE" ||
        period < billing.contract.startDate ||
        period > billing.contract.endDate ||
        billing.nextRunDate.getTime() !== period.getTime()
      ) {
        await this.failJob(
          job.id,
          workerId,
          job.attempts,
          job.maxRetries,
          new Error("Konfigurasi billing tidak valid untuk periode job."),
          true,
        );

        return { status: "FAILED" as const, jobId: job.id };
      }

      const invoice = await this.generatorService.generateInvoice(billing.id, {
        jobId: job.id,
        workerId,
        billingPeriodStart: job.billingPeriodStart,
      });

      return {
        status: "COMPLETED" as const,
        jobId: job.id,
        invoiceId: invoice.id,
      };
    } catch (error) {
      const existingInvoice = await this.findGeneratedInvoice(
        job.recurringBillingId,
        job.billingPeriodStart,
      ).catch(() => null);

      if (existingInvoice) {
        const completed = await this.completeJob(
          job.id,
          workerId,
          existingInvoice.id,
        );

        return {
          status: completed ? ("COMPLETED" as const) : ("LOCK_LOST" as const),
          jobId: job.id,
          invoiceId: existingInvoice.id,
        };
      }

      await this.failJob(job.id, workerId, job.attempts, job.maxRetries, error);

      console.error(
        `[RECURRING_BILLING_JOB] job=${job.id} attempt=${job.attempts}`,
        error,
      );

      return {
        status: "FAILED" as const,
        jobId: job.id,
      };
    }
  }
}
