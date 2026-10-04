import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express, { json } from "express";
import helmet from "helmet";
import "reflect-metadata";
import { container } from "tsyringe";
import { env } from "./config";

import { errorMiddleware } from "./middleware/error.middleware";
import { globalLimiter } from "./middleware/rateLimiter.middleware";
import { ActivityRouter } from "./modules/activity/activity.router";
import { AuthRouter } from "./modules/auth/auth.router";
import { ClientRouter } from "./modules/client/client.route";
import { ContactPersonRouter } from "./modules/contact-person/contact-person.route";
import { ContractRouter } from "./modules/contract/contract.route";
import { LeadRouter } from "./modules/lead/lead.router";
import { MasterServiceRouter } from "./modules/master-service/master-service.router";
import { ProposalRouter } from "./modules/proposal/proposal.router";
import { QuotationRouter } from "./modules/quotation/quotation.router";
import { RbacRouter } from "./modules/rbac/rbac.router";
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
    this.app.use(helmet());

    this.app.use(globalLimiter);
    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
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

    // 1. Pasang cookie-parser lebih awal agar req.cookies langsung siap dibaca
    this.app.use(cookieParser());

    // 2. Parser JSON untuk body request
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
        // initializeCronJobs();
      } catch (error) {
        console.error("❌ Gagal menginisialisasi Cron Jobs:", error);
      }
    });
  }
}
