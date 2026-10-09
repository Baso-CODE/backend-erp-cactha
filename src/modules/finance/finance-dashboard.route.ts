import { NextFunction, Request, Response, Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { FinanceAgingController } from "./controller/finance-aging.controller";
import { FinanceDashboardController } from "./controller/finance-dashboard.controller";
import { FinanceReportController } from "./controller/finance-report.controller";
import { RevenueReportController } from "./controller/revenue-report.controller";
import { ExportInvoiceQueryDTO } from "./dto/export-invoice-query.dto";
import { ExportPaymentQueryDTO } from "./dto/export-payment-query.dto";
import { QueryReportHistoryDTO } from "./dto/query-report-history.dto";
import { QueryRevenueReportDTO } from "./dto/query-revenue-report.dto";

function requireFinanceReportRead(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Autentikasi gagal. Sesi tidak valid.",
    });
    return;
  }

  const permissions: string[] = user.permissions ?? [];

  if (
    !permissions.includes("invoice.read") &&
    !permissions.includes("payment.read")
  ) {
    res.status(403).json({
      success: false,
      message: "Anda tidak memiliki akses laporan Finance.",
    });
    return;
  }

  next();
}

@injectable()
export class FinanceDashboardRouter {
  private readonly router: Router = Router();

  constructor(
    private readonly financeDashboardController: FinanceDashboardController,
    private readonly financeAgingController: FinanceAgingController,
    private readonly financeReportController: FinanceReportController,
    private readonly revenueReportController: RevenueReportController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/dashboard",
      authenticateToken,
      requirePermissions("invoice.read"),
      this.financeDashboardController.getDashboard,
    );

    this.router.get(
      "/reports/revenue/summary",
      authenticateToken,
      requirePermissions("invoice.read"),
      requirePermissions("payment.read"),
      validateQuery(QueryRevenueReportDTO),
      this.revenueReportController.getSummary,
    );

    this.router.get(
      "/reports/revenue/trend",
      authenticateToken,
      requirePermissions("invoice.read"),
      requirePermissions("payment.read"),
      validateQuery(QueryRevenueReportDTO),
      this.revenueReportController.getTrend,
    );

    this.router.get(
      "/reports/revenue/clients",
      authenticateToken,
      requirePermissions("invoice.read"),
      requirePermissions("payment.read"),
      validateQuery(QueryRevenueReportDTO),
      this.revenueReportController.getRevenueByClients,
    );

    this.router.get(
      "/reports/revenue/projects",
      authenticateToken,
      requirePermissions("invoice.read"),
      requirePermissions("payment.read"),
      validateQuery(QueryRevenueReportDTO),
      this.revenueReportController.getRevenueByProjects,
    );

    this.router.get(
      "/aging",
      authenticateToken,
      requirePermissions("invoice.read"),
      this.financeAgingController.getAging,
    );

    this.router.get(
      "/reports/history",
      authenticateToken,
      requireFinanceReportRead,
      validateQuery(QueryReportHistoryDTO),
      this.financeReportController.getReportHistory,
    );

    this.router.get(
      "/reports/invoices.csv",
      authenticateToken,
      requirePermissions("invoice.read"),
      validateQuery(ExportInvoiceQueryDTO),
      this.financeReportController.exportInvoices,
    );

    this.router.get(
      "/reports/payments.csv",
      authenticateToken,
      requirePermissions("payment.read"),
      validateQuery(ExportPaymentQueryDTO),
      this.financeReportController.exportPayments,
    );

    this.router.get(
      "/reports/aging.csv",
      authenticateToken,
      requirePermissions("invoice.read"),
      this.financeReportController.exportAging,
    );

    this.router.get(
      "/reports/invoices.xlsx",
      authenticateToken,
      requirePermissions("invoice.read"),
      validateQuery(ExportInvoiceQueryDTO),
      this.financeReportController.exportInvoicesXlsx,
    );

    this.router.get(
      "/reports/payments.xlsx",
      authenticateToken,
      requirePermissions("payment.read"),
      validateQuery(ExportPaymentQueryDTO),
      this.financeReportController.exportPaymentsXlsx,
    );

    this.router.get(
      "/reports/aging.xlsx",
      authenticateToken,
      requirePermissions("invoice.read"),
      this.financeReportController.exportAgingXlsx,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
