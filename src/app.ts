import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express, { json } from "express";
import helmet from "helmet";
import "reflect-metadata";
import { container } from "tsyringe";
import { env } from "./config";

import { initializeNotificationCron } from "./cron/notification.cron";
import { initializeRecurringBillingCron } from "./cron/recurring-billing.cron";
import { errorMiddleware } from "./middleware/error.middleware";
import { globalLimiter } from "./middleware/rateLimiter.middleware";
import { ActivityRouter } from "./modules/activity/activity.router";
import { AuthRouter } from "./modules/auth/auth.router";
import { ClientPortalRouter } from "./modules/client-portal/client-portal.router";
import { ClientRouter } from "./modules/client/client.route";
import { ContactPersonRouter } from "./modules/contact-person/contact-person.route";
import { ContractRouter } from "./modules/contract/contract.route";
import { FinanceDashboardRouter } from "./modules/finance/finance-dashboard.route";
import { InvoiceRouter } from "./modules/invoice/invoice.router";
import { LeadRouter } from "./modules/lead/lead.router";
import { MasterServiceRouter } from "./modules/master-service/master-service.router";
import { NotificationRouter } from "./modules/notification/notification.router";
import { PaymentRouter } from "./modules/payment/payment.route";
import { ProfitabilityRouter } from "./modules/profitability/profitability.route";
import { ProjectServiceRouter } from "./modules/project-service/project-service.route";
import { ProjectRouter } from "./modules/project/project.router";
import { ProposalRouter } from "./modules/proposal/proposal.router";
import { QuotationRouter } from "./modules/quotation/quotation.router";
import { RbacRouter } from "./modules/rbac/rbac.router";
import { RecurringBillingRouter } from "./modules/recurring-billing/recurring-billing.route";
import { ProjectReportRouter } from "./modules/reporting/project-report.route";
import { TaskAttachmentRoute } from "./modules/task/route/task-attachment.route";
import { TaskChecklistRoute } from "./modules/task/route/task-checklist.route";
import { TaskCommentRoute } from "./modules/task/route/task-comment.route";
import { TaskRoute } from "./modules/task/route/task.route";
import { TeamRouter } from "./modules/team/team.router";
import { WorkflowTemplateRouter } from "./modules/workflow-template/workflow-template.route";

export default class App {
  public app;

  constructor() {
    this.app = express();
    this.configure();
    this.routes();
    this.handleError();
  }

  private configure(): void {
    this.app.set("trust proxy", 1);

    this.app.use(helmet());

    this.app.use(
      cors({
        origin: env().CORS_ORIGIN,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-Requested-With",
          "x-country",
        ],
      }),
    );

    this.app.use(globalLimiter);
    this.app.use(cookieParser());
    this.app.use(json({ limit: "50mb" }));
  }
  private routes(): void {
    const rbacRouter = container.resolve(RbacRouter);
    const authRouter = container.resolve(AuthRouter);
    const leadRouter = container.resolve(LeadRouter);
    const activityRouter = container.resolve(ActivityRouter);
    const proposalRouter = container.resolve(ProposalRouter);
    const quotationRouter = container.resolve(QuotationRouter);
    const clientRouter = container.resolve(ClientRouter);
    const contactPersonRouter = container.resolve(ContactPersonRouter);
    const contractRouter = container.resolve(ContractRouter);
    const masterServiceRouter = container.resolve(MasterServiceRouter);
    const workflowTemplateRouter = container.resolve(WorkflowTemplateRouter);
    const projectRouter = container.resolve(ProjectRouter);
    const projectServiceRouter = container.resolve(ProjectServiceRouter);
    const taskRoute = container.resolve(TaskRoute);
    const taskChecklistRoute = container.resolve(TaskChecklistRoute);
    const taskCommentRoute = container.resolve(TaskCommentRoute);
    const taskAttachmentRoute = container.resolve(TaskAttachmentRoute);
    const notificationRouter = container.resolve(NotificationRouter);
    const teamRouter = container.resolve(TeamRouter);
    const clientPortalRouter = container.resolve(ClientPortalRouter);
    const invoiceRouter = container.resolve(InvoiceRouter);
    const paymentRouter = container.resolve(PaymentRouter);
    const financeDashboardRouter = container.resolve(FinanceDashboardRouter);
    const recurringBillingRouter = container.resolve(RecurringBillingRouter);
    const profitabilityRouter = container.resolve(ProfitabilityRouter);
    const projectReportRouter = container.resolve(ProjectReportRouter);

    this.app.get("/", (_, res) => {
      res.send("Welcome");
    });
    this.app.use("/rbac", rbacRouter.getRouter());
    this.app.use("/auth", authRouter.getRouter());
    this.app.use("/leads", leadRouter.getRouter());
    this.app.use("/activities", activityRouter.getRouter());
    this.app.use("/proposals", proposalRouter.getRouter());
    this.app.use("/quotations", quotationRouter.getRouter());
    this.app.use("/clients", clientRouter.getRouter());
    this.app.use("/contact-persons", contactPersonRouter.getRouter());
    this.app.use("/contracts", contractRouter.getRouter());
    this.app.use("/master-services", masterServiceRouter.getRouter());
    this.app.use("/workflow-templates", workflowTemplateRouter.getRouter());
    this.app.use("/projects", projectRouter.getRouter());
    this.app.use("/project-services", projectServiceRouter.getRouter());
    this.app.use("/tasks", taskRoute.router);
    this.app.use("/", taskChecklistRoute.router);
    this.app.use("/", taskCommentRoute.router);
    this.app.use("/", taskAttachmentRoute.router);
    this.app.use("/notifications", notificationRouter.getRouter());
    this.app.use("/teams", teamRouter.router);
    this.app.use("/client", clientPortalRouter.getRouter());
    this.app.use("/invoices", invoiceRouter.getRouter());
    this.app.use("/payments", paymentRouter.getRouter());
    this.app.use("/finance", financeDashboardRouter.getRouter());
    this.app.use("/recurring-billings", recurringBillingRouter.getRouter());
    this.app.use("/profitability", profitabilityRouter.getRouter());
    this.app.use("/reports", projectReportRouter.getRouter());
  }

  private handleError(): void {
    this.app.use(errorMiddleware);
  }

  public async start(): Promise<void> {
    try {
      //   const prismaService = container.resolve(PrismaService);
      // matikan kalau sudah di deploy
      // await syncPermissionsToDatabase(prismaService);
      //   console.log("✅ Sinkronisasi permissions berhasil dijalankan!");
    } catch (error) {
      console.error("❌ Gagal menjalankan sinkronisasi permissions:", error);
    }

    // Melanjutkan menyalakan server Express
    this.app.listen(env().PORT, () => {
      console.log(`  ➜  [API] Local:   http://localhost:${env().PORT}`);
      try {
        initializeNotificationCron();
        initializeRecurringBillingCron();
        console.log("✅ Notification cron berhasil diinisialisasi");
      } catch (error) {
        console.error("❌ Gagal menginisialisasi Cron Jobs:", error);
      }
    });
  }
}
