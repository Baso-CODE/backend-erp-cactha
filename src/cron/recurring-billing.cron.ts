import cron from "node-cron";
import { container } from "tsyringe";
import { RecurringBillingJobProcessorService } from "../modules/recurring-billing/services/recurring-billing-job-processor.service";
import { RecurringBillingJobService } from "../modules/recurring-billing/services/recurring-billing-job.service";

const BATCH_SIZE = 25;
let isRunning = false;
let isInitialized = false;

export function initializeRecurringBillingCron(): void {
  if (isInitialized) return;
  isInitialized = true;

  const jobService = container.resolve(RecurringBillingJobService);
  const processor = container.resolve(RecurringBillingJobProcessorService);
  const workerId = jobService.createWorkerId();

  cron.schedule(
    "* * * * *",
    async () => {
      if (isRunning) return;
      isRunning = true;

      try {
        const recovered = await jobService.recoverExpiredLocks();
        const enqueued = await jobService.enqueueDueBillings();

        let completed = 0;
        let failed = 0;
        let lockLost = 0;
        let processed = 0;

        for (let i = 0; i < BATCH_SIZE; i++) {
          const result = await processor.processNextJob(workerId);

          if (result.status === "EMPTY") break;

          processed++;

          switch (result.status) {
            case "COMPLETED":
              completed++;
              break;
            case "FAILED":
              failed++;
              break;
            case "LOCK_LOST":
              lockLost++;
              break;
          }
        }

        if (recovered.recovered > 0 || enqueued.queued > 0 || processed > 0) {
          console.log(
            `[CRON][RECURRING_BILLING] worker=${workerId} queued=${enqueued.queued} recovered=${recovered.recovered} processed=${processed} completed=${completed} failed=${failed} lockLost=${lockLost}`,
          );
        }
      } catch (error) {
        console.error(
          "[CRON][RECURRING_BILLING] Gagal menjalankan worker:",
          error,
        );
      } finally {
        isRunning = false;
      }
    },
    { timezone: "UTC" },
  );

  console.log(`[CRON][RECURRING_BILLING] Worker initialized: ${workerId}`);
}
