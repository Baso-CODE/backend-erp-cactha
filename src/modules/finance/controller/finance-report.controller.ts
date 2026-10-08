import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { ExportInvoiceQueryDTO } from "../dto/export-invoice-query.dto";
import { ExportPaymentQueryDTO } from "../dto/export-payment-query.dto";
import { QueryReportHistoryDTO } from "../dto/query-report-history.dto";
import { FinanceReportService } from "../services/finance-report.service";

@injectable()
export class FinanceReportController {
  constructor(private readonly financeReportService: FinanceReportService) {}

  exportInvoices = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as ExportInvoiceQueryDTO;

      const csv = await this.financeReportService.exportInvoices(
        query,
        user.id,
      );

      await this.financeReportService.recordReportExport(
        user.id,
        "INVOICE",
        "CSV",
        { ...query },
      );

      this.sendCsv(res, csv, "finance-invoices");
    } catch (error) {
      next(error);
    }
  };

  exportPayments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as ExportPaymentQueryDTO;

      const csv = await this.financeReportService.exportPayments(
        query,
        user.id,
      );

      await this.financeReportService.recordReportExport(
        user.id,
        "PAYMENT",
        "CSV",
        { ...query },
      );

      this.sendCsv(res, csv, "finance-payments");
    } catch (error) {
      next(error);
    }
  };

  exportAging = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const csv = await this.financeReportService.exportAging(user.id);

      await this.financeReportService.recordReportExport(
        user.id,
        "AGING",
        "CSV",
      );

      this.sendCsv(res, csv, "finance-aging");
    } catch (error) {
      next(error);
    }
  };

  exportInvoicesXlsx = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as ExportInvoiceQueryDTO;

      const buffer = await this.financeReportService.exportInvoicesXlsx(
        query,
        user.id,
      );

      await this.financeReportService.recordReportExport(
        user.id,
        "INVOICE",
        "XLSX",
        { ...query },
      );

      this.sendXlsx(res, buffer, "finance-invoices");
    } catch (error) {
      next(error);
    }
  };

  exportPaymentsXlsx = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as ExportPaymentQueryDTO;

      const buffer = await this.financeReportService.exportPaymentsXlsx(
        query,
        user.id,
      );

      await this.financeReportService.recordReportExport(
        user.id,
        "PAYMENT",
        "XLSX",
        { ...query },
      );

      this.sendXlsx(res, buffer, "finance-payments");
    } catch (error) {
      next(error);
    }
  };

  exportAgingXlsx = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const buffer = await this.financeReportService.exportAgingXlsx(user.id);

      await this.financeReportService.recordReportExport(
        user.id,
        "AGING",
        "XLSX",
      );

      this.sendXlsx(res, buffer, "finance-aging");
    } catch (error) {
      next(error);
    }
  };

  getReportHistory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryReportHistoryDTO;

      const result = await this.financeReportService.getReportHistory(
        user.id,
        user.permissions ?? [],
        query.page,
        query.limit,
      );

      res.status(200).json({
        success: true,
        message: "Riwayat export laporan berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  private sendCsv(res: Response, csv: string, prefix: string): void {
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${prefix}-${date}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).send(csv);
  }

  private sendXlsx(res: Response, buffer: Buffer, prefix: string): void {
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${prefix}-${date}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).end(buffer);
  }
}
