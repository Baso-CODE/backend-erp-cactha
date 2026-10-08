import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { PrismaService } from "../../prisma/prisma.service";

type AgingBucket =
  | "CURRENT"
  | "DAYS_1_30"
  | "DAYS_31_60"
  | "DAYS_61_90"
  | "DAYS_90_PLUS";

interface AgingSummary {
  currency: string;
  totalOutstanding: Prisma.Decimal;
  current: Prisma.Decimal;
  days1To30: Prisma.Decimal;
  days31To60: Prisma.Decimal;
  days61To90: Prisma.Decimal;
  days90Plus: Prisma.Decimal;
  invoiceCount: number;
}

@injectable()
export class FinanceAgingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  async getAging(actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.read",
    );

    const where: Prisma.InvoiceWhereInput = {
      status: {
        notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED],
      },
      ...(scope !== "ALL" && {
        client: { accountManagerId: actorId },
      }),
    };

    const invoices = await this.prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNo: true,
        invoiceDate: true,
        dueDate: true,
        currency: true,
        totalAmount: true,
        client: {
          select: {
            id: true,
            clientCode: true,
            companyName: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.VERIFIED },
          select: { amountPaid: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const now = new Date();
    const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const dayMs = 24 * 60 * 60 * 1000;
    const zero = new Prisma.Decimal(0);

    const summaries = new Map<string, AgingSummary>();

    const items: {
      id: string;
      invoiceNo: string;
      client: {
        id: string;
        clientCode: string;
        companyName: string;
      };
      invoiceDate: Date;
      dueDate: Date;
      currency: string;
      totalAmount: string;
      paidAmount: string;
      outstandingAmount: string;
      daysOverdue: number;
      bucket: AgingBucket;
    }[] = [];

    for (const invoice of invoices) {
      const paidAmount = invoice.payments.reduce(
        (sum, payment) => sum.add(payment.amountPaid),
        new Prisma.Decimal(0),
      );

      const outstanding = Prisma.Decimal.max(
        invoice.totalAmount.sub(paidAmount),
        zero,
      );

      if (outstanding.lessThanOrEqualTo(0)) continue;

      const due = Date.UTC(
        invoice.dueDate.getUTCFullYear(),
        invoice.dueDate.getUTCMonth(),
        invoice.dueDate.getUTCDate(),
      );

      const daysOverdue = Math.max(0, Math.round((today - due) / dayMs));

      let bucket: AgingBucket = "CURRENT";

      if (daysOverdue > 90) bucket = "DAYS_90_PLUS";
      else if (daysOverdue > 60) bucket = "DAYS_61_90";
      else if (daysOverdue > 30) bucket = "DAYS_31_60";
      else if (daysOverdue > 0) bucket = "DAYS_1_30";

      const summary = summaries.get(invoice.currency) ?? {
        currency: invoice.currency,
        totalOutstanding: new Prisma.Decimal(0),
        current: new Prisma.Decimal(0),
        days1To30: new Prisma.Decimal(0),
        days31To60: new Prisma.Decimal(0),
        days61To90: new Prisma.Decimal(0),
        days90Plus: new Prisma.Decimal(0),
        invoiceCount: 0,
      };

      summary.totalOutstanding = summary.totalOutstanding.add(outstanding);
      summary.invoiceCount++;

      switch (bucket) {
        case "CURRENT":
          summary.current = summary.current.add(outstanding);
          break;
        case "DAYS_1_30":
          summary.days1To30 = summary.days1To30.add(outstanding);
          break;
        case "DAYS_31_60":
          summary.days31To60 = summary.days31To60.add(outstanding);
          break;
        case "DAYS_61_90":
          summary.days61To90 = summary.days61To90.add(outstanding);
          break;
        case "DAYS_90_PLUS":
          summary.days90Plus = summary.days90Plus.add(outstanding);
          break;
      }

      summaries.set(invoice.currency, summary);

      items.push({
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        client: invoice.client,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        totalAmount: invoice.totalAmount.toString(),
        paidAmount: paidAmount.toString(),
        outstandingAmount: outstanding.toString(),
        daysOverdue,
        bucket,
      });
    }

    return {
      asOf: now.toISOString(),
      summary: Array.from(summaries.values()).map((item) => ({
        currency: item.currency,
        totalOutstanding: item.totalOutstanding.toString(),
        current: item.current.toString(),
        days1To30: item.days1To30.toString(),
        days31To60: item.days31To60.toString(),
        days61To90: item.days61To90.toString(),
        days90Plus: item.days90Plus.toString(),
        invoiceCount: item.invoiceCount,
      })),
      items,
    };
  }
}
