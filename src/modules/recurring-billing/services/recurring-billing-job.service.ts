import { Prisma, RecurringBillingJobStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { injectable } from "tsyringe";
import { PrismaService } from "../../prisma/prisma.service";

const PAGE_SIZE = 100;
const MAX_SCAN = 1000;
const JOB_LIMIT = 25;
const LOCK_MS = 60_000;

@injectable()
export class RecurringBillingJobService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueDueBillings() {
    const now = new Date();
    let cursor: string | undefined;
    let scanned = 0;
    let queued = 0;

    while (scanned < MAX_SCAN && queued < JOB_LIMIT) {
      const billings = await this.prisma.recurringBilling.findMany({
        where: {
          isActive: true,
          billingAnchorDay: { not: null },
          nextRunDate: { lte: now },
          contract: { status: "ACTIVE" },
        },
        select: {
          id: true,
          nextRunDate: true,
          contract: {
            select: { startDate: true, endDate: true },
          },
        },
        orderBy: { id: "asc" },
        take: Math.min(PAGE_SIZE, MAX_SCAN - scanned),
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });

      if (!billings.length) break;

      cursor = billings[billings.length - 1].id;
      scanned += billings.length;

      for (const billing of billings) {
        const period = billing.nextRunDate;

        if (
          period < billing.contract.startDate ||
          period > billing.contract.endDate
        ) {
          continue;
        }

        const existingInvoice = await this.prisma.invoice.findFirst({
          where: {
            recurringBillingId: billing.id,
            billingPeriodStart: period,
          },
          select: { id: true },
        });

        const existingJob = await this.prisma.recurringBillingJob.findUnique({
          where: {
            recurringBillingId_billingPeriodStart: {
              recurringBillingId: billing.id,
              billingPeriodStart: period,
            },
          },
          select: { id: true },
        });

        if (existingJob) continue;

        try {
          await this.prisma.recurringBillingJob.create({
            data: {
              recurringBillingId: billing.id,
              billingPeriodStart: period,
              status: existingInvoice
                ? RecurringBillingJobStatus.COMPLETED
                : RecurringBillingJobStatus.PENDING,
              ...(existingInvoice && {
                invoiceId: existingInvoice.id,
                completedAt: now,
              }),
            },
          });

          queued++;

          if (queued >= JOB_LIMIT) break;
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            continue;
          }

          throw error;
        }
      }

      if (billings.length < PAGE_SIZE) break;
    }

    return { scanned, queued };
  }

  async claimNextJob(workerId: string) {
    const now = new Date();

    const candidates = await this.prisma.recurringBillingJob.findMany({
      where: {
        OR: [
          { status: "PENDING" },
          {
            status: "FAILED",
            nextRetryAt: { lte: now },
          },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
    });

    for (const job of candidates) {
      if (job.attempts >= job.maxRetries) continue;

      const claimed = await this.prisma.recurringBillingJob.updateMany({
        where: {
          id: job.id,
          status: job.status,
          attempts: job.attempts,
          ...(job.status === "FAILED" && {
            nextRetryAt: { lte: now },
          }),
        },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          lockedBy: workerId,
          lockedUntil: new Date(now.getTime() + LOCK_MS),
          startedAt: now,
          lastError: null,
          nextRetryAt: null,
        },
      });

      if (claimed.count !== 1) continue;

      return this.prisma.recurringBillingJob.findUnique({
        where: { id: job.id },
      });
    }

    return null;
  }

  async recoverExpiredLocks() {
    const now = new Date();

    const expired = await this.prisma.recurringBillingJob.findMany({
      where: {
        status: "PROCESSING",
        lockedUntil: { lt: now },
      },
      select: {
        id: true,
        lockedBy: true,
        lockedUntil: true,
        attempts: true,
        maxRetries: true,
      },
      take: 100,
      orderBy: { lockedUntil: "asc" },
    });

    let recovered = 0;

    for (const job of expired) {
      const exhausted = job.attempts >= job.maxRetries;

      const result = await this.prisma.recurringBillingJob.updateMany({
        where: {
          id: job.id,
          status: "PROCESSING",
          lockedBy: job.lockedBy,
          lockedUntil: job.lockedUntil,
        },
        data: {
          status: "FAILED",
          lockedBy: null,
          lockedUntil: null,
          nextRetryAt: exhausted ? null : now,
          lastError: "Worker lock expired before completion.",
        },
      });

      recovered += result.count;
    }

    return { checked: expired.length, recovered };
  }

  createWorkerId() {
    return randomUUID();
  }
}
