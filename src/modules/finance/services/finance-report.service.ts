import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { ExportPaymentQueryDTO } from "../dto/export-payment-query.dto";
import { buildFinanceCsv } from "../helpers/build-finance-csv";
import { buildFinanceXlsx } from "../helpers/build-finance-xlsx";
import { FinanceAgingService } from "./finance-aging.service";
type FinanceReportKind = "INVOICE" | "PAYMENT" | "AGING";
type FinanceReportFormat = "CSV" | "XLSX";
export interface InvoiceExportQuery {
  status?: InvoiceStatus;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

@injectable()
export class FinanceReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
    private readonly financeAgingService: FinanceAgingService,
  ) {}

  async exportInvoices(query: InvoiceExportQuery, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.read",
    );

    const where: Prisma.InvoiceWhereInput = {
      AND: [
        scope === "ALL" ? {} : { client: { accountManagerId: actorId } },
        {
          ...(query.status && { status: query.status }),
          ...(query.clientId && { clientId: query.clientId }),
          ...((query.dateFrom || query.dateTo) && {
            invoiceDate: {
              ...(query.dateFrom && {
                gte: new Date(`${query.dateFrom}T00:00:00.000Z`),
              }),
              ...(query.dateTo && {
                lte: new Date(`${query.dateTo}T23:59:59.999Z`),
              }),
            },
          }),
        },
      ],
    };

    const rows = await this.prisma.invoice.findMany({
      where,
      take: 10001,
      orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
      select: {
        invoiceNo: true,
        invoiceDate: true,
        dueDate: true,
        status: true,
        currency: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
        client: {
          select: {
            clientCode: true,
            companyName: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.VERIFIED },
          select: { amountPaid: true },
        },
      },
    });

    if (rows.length > 10000) {
      throw new ApiError(
        "Data export melebihi 10.000 invoice. Persempit periode atau filter.",
        400,
      );
    }

    const header = [
      "Invoice No",
      "Client Code",
      "Client",
      "Invoice Date",
      "Due Date",
      "Status",
      "Currency",
      "Subtotal",
      "Discount",
      "Tax",
      "Total",
      "Paid",
      "Outstanding",
      "Overdue",
    ];

    const data = rows.map((invoice) => {
      const paid = invoice.payments.reduce(
        (total, payment) => total.add(payment.amountPaid),
        new Prisma.Decimal(0),
      );

      const outstanding = Prisma.Decimal.max(
        invoice.totalAmount.sub(paid),
        new Prisma.Decimal(0),
      );

      const overdue =
        outstanding.greaterThan(0) &&
        invoice.dueDate.getTime() < Date.now() &&
        !["DRAFT", "CANCELLED"].includes(invoice.status);

      return [
        invoice.invoiceNo,
        invoice.client.clientCode,
        invoice.client.companyName,
        invoice.invoiceDate.toISOString().slice(0, 10),
        invoice.dueDate.toISOString().slice(0, 10),
        invoice.status,
        invoice.currency,
        invoice.subtotal.toFixed(2),
        invoice.discountAmount.toFixed(2),
        invoice.taxAmount.toFixed(2),
        invoice.totalAmount.toFixed(2),
        paid.toFixed(2),
        outstanding.toFixed(2),
        overdue ? "YES" : "NO",
      ];
    });

    const escapeCsv = (value: string) => {
      const safe = /^[\s]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const csv = [header, ...data]
      .map((row) => row.map((value) => escapeCsv(String(value))).join(","))
      .join("\r\n");

    return `\uFEFF${csv}\r\n`;
  }

  async exportPayments(query: ExportPaymentQueryDTO, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "payment.read",
    );

    const where: Prisma.PaymentWhereInput = {
      AND: [
        scope === "ALL"
          ? {}
          : {
              invoice: {
                client: { accountManagerId: actorId },
              },
            },
        {
          ...(query.status && { status: query.status }),
          ...(query.paymentMethod && {
            paymentMethod: query.paymentMethod,
          }),
          ...(query.clientId && {
            invoice: { clientId: query.clientId },
          }),
          ...((query.dateFrom || query.dateTo) && {
            paymentDate: {
              ...(query.dateFrom && {
                gte: new Date(`${query.dateFrom}T00:00:00.000Z`),
              }),
              ...(query.dateTo && {
                lte: new Date(`${query.dateTo}T23:59:59.999Z`),
              }),
            },
          }),
        },
      ],
    };

    const payments = await this.prisma.payment.findMany({
      where,
      take: 10001,
      orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
      select: {
        paymentNo: true,
        paymentDate: true,
        paymentMethod: true,
        amountPaid: true,
        reference: true,
        status: true,
        verifiedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        invoice: {
          select: {
            invoiceNo: true,
            currency: true,
            client: {
              select: {
                clientCode: true,
                companyName: true,
              },
            },
          },
        },
      },
    });

    if (payments.length > 10000) {
      throw new ApiError(
        "Export melebihi 10.000 payment. Persempit filter.",
        400,
      );
    }

    const headers = [
      "Payment No",
      "Invoice No",
      "Client Code",
      "Client",
      "Payment Date",
      "Method",
      "Currency",
      "Amount Paid",
      "Reference",
      "Status",
      "Verified At",
      "Rejected At",
      "Rejection Reason",
    ];

    const rows = payments.map((payment) => [
      payment.paymentNo,
      payment.invoice.invoiceNo,
      payment.invoice.client.clientCode,
      payment.invoice.client.companyName,
      payment.paymentDate.toISOString().slice(0, 10),
      payment.paymentMethod,
      payment.invoice.currency,
      payment.amountPaid.toFixed(2),
      payment.reference ?? "",
      payment.status,
      payment.verifiedAt?.toISOString() ?? "",
      payment.rejectedAt?.toISOString() ?? "",
      payment.rejectionReason ?? "",
    ]);

    return buildFinanceCsv(headers, rows);
  }

  async exportAging(actorId: string) {
    const result = await this.financeAgingService.getAging(actorId);

    if (result.items.length > 10000) {
      throw new ApiError("Export melebihi 10.000 invoice outstanding.", 400);
    }

    const headers = [
      "Invoice No",
      "Client Code",
      "Client",
      "Invoice Date",
      "Due Date",
      "Currency",
      "Total Invoice",
      "Paid Amount",
      "Outstanding",
      "Days Overdue",
      "Aging Bucket",
      "Report As Of",
    ];

    const bucketLabels = {
      CURRENT: "Current",
      DAYS_1_30: "1-30 Days",
      DAYS_31_60: "31-60 Days",
      DAYS_61_90: "61-90 Days",
      DAYS_90_PLUS: "90+ Days",
    };

    const rows = result.items.map((item) => [
      item.invoiceNo,
      item.client.clientCode,
      item.client.companyName,
      new Date(item.invoiceDate).toISOString().slice(0, 10),
      new Date(item.dueDate).toISOString().slice(0, 10),
      item.currency,
      item.totalAmount,
      item.paidAmount,
      item.outstandingAmount,
      item.daysOverdue,
      bucketLabels[item.bucket],
      result.asOf,
    ]);

    return buildFinanceCsv(headers, rows);
  }

  async exportInvoicesXlsx(query: InvoiceExportQuery, actorId: string) {
    const csv = await this.exportInvoices(query, actorId);

    return buildFinanceXlsx({
      csv,
      sheetName: "Invoices",
      moneyColumns: [8, 9, 10, 11, 12, 13],
      dateColumns: [4, 5],
    });
  }

  async exportPaymentsXlsx(query: ExportPaymentQueryDTO, actorId: string) {
    const csv = await this.exportPayments(query, actorId);

    return buildFinanceXlsx({
      csv,
      sheetName: "Payments",
      moneyColumns: [8],
      dateColumns: [5],
    });
  }

  async exportAgingXlsx(actorId: string) {
    const csv = await this.exportAging(actorId);

    return buildFinanceXlsx({
      csv,
      sheetName: "AR Aging",
      moneyColumns: [7, 8, 9],
      dateColumns: [4, 5],
    });
  }

  async recordReportExport(
    actorId: string,
    reportType: FinanceReportKind,
    format: FinanceReportFormat,
    filters: Prisma.InputJsonObject = {},
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: "EXPORT",
        entity: "FinanceReport",
        entityId: randomUUID(),
        details: {
          reportType,
          format,
          filters,
          exportedAt: new Date().toISOString(),
        },
      },
    });
  }

  async getReportHistory(
    actorId: string,
    permissions: string[],
    page = 1,
    limit = 10,
  ) {
    const allowedTypes: FinanceReportKind[] = [];

    if (permissions.includes("invoice.read")) {
      allowedTypes.push("INVOICE", "AGING");
    }

    if (permissions.includes("payment.read")) {
      allowedTypes.push("PAYMENT");
    }

    if (allowedTypes.length === 0) {
      throw new ApiError("Tidak memiliki akses laporan Finance.", 403);
    }

    const where: Prisma.AuditLogWhereInput = {
      userId: actorId,
      entity: "FinanceReport",
      action: "EXPORT",
      OR: allowedTypes.map((reportType) => ({
        details: {
          path: "$.reportType",
          equals: reportType,
        },
      })),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          details: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
