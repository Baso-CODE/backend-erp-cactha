import cron from "node-cron";
import { container } from "tsyringe";
import { PrismaService } from "../modules/prisma/prisma.service";
import { RecurringBillingGeneratorService } from "../modules/recurring-billing/recurring-billing-generator.service";

const BATCH_SIZE = 25;
let isRunning = false;

export function initializeRecurringBillingCron(): void {
  cron.schedule(
    "* * * * *",
    async () => {
      if (isRunning) return;

      isRunning = true;

      try {
        const prisma = container.resolve(PrismaService);
        const generator = container.resolve(RecurringBillingGeneratorService);
        const now = new Date();

        const billings = await prisma.recurringBilling.findMany({
          where: {
            isActive: true,
            nextRunDate: { lte: now },
            contract: {
              status: "ACTIVE",
            },
          },
          select: {
            id: true,
            nextRunDate: true,
            contract: {
              select: {
                endDate: true,
              },
            },
          },
          orderBy: { nextRunDate: "asc" },
          take: BATCH_SIZE,
        });

        let generated = 0;
        let failed = 0;

        for (const billing of billings) {
          if (billing.nextRunDate > billing.contract.endDate) {
            console.warn(
              `[CRON][RECURRING_BILLING] Jadwal ${billing.id} melewati akhir kontrak.`,
            );
            continue;
          }

          try {
            await generator.generateInvoice(billing.id);
            generated++;
          } catch (error) {
            failed++;
            console.error(
              `[CRON][RECURRING_BILLING] Gagal billing ${billing.id}:`,
              error,
            );
          }
        }

        if (billings.length > 0) {
          console.log(
            `[CRON][RECURRING_BILLING] checked=${billings.length} generated=${generated} failed=${failed}`,
          );
        }
      } catch (error) {
        console.error("[CRON][RECURRING_BILLING] Error:", error);
      } finally {
        isRunning = false;
      }
    },
    {
      timezone: "UTC",
    },
  );
}
