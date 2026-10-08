import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { PrismaService } from "../../prisma/prisma.service";

@injectable()
export class FinanceDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  async getDashboard(actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.read",
    );

    const accessFilter: Prisma.InvoiceWhereInput =
      scope === "ALL" ? {} : { client: { accountManagerId: actorId } };

    const where: Prisma.InvoiceWhereInput = {
      AND: [
        accessFilter,
        {
          status: {
            notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED],
          },
        },
      ],
    };

    const now = new Date();
    const dueSoonUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const zero = new Prisma.Decimal(0);

    const [invoices, recentPayments] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNo: true,
          clientId: true,
          currency: true,
          totalAmount: true,
          dueDate: true,
          status: true,
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
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.VERIFIED,
          invoice: where,
        },
        orderBy: [{ verifiedAt: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          paymentNo: true,
          amountPaid: true,
          paymentDate: true,
          paymentMethod: true,
          verifiedAt: true,
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              currency: true,
              client: {
                select: {
                  id: true,
                  companyName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const currencies = new Map<
      string,
      {
        totalInvoiced: Prisma.Decimal;
        totalPaid: Prisma.Decimal;
        totalOutstanding: Prisma.Decimal;
        overdueAmount: Prisma.Decimal;
        dueSoonAmount: Prisma.Decimal;
        invoiceCount: number;
        overdueCount: number;
        dueSoonCount: number;
      }
    >();

    const clients = new Map<
      string,
      {
        clientId: string;
        clientCode: string;
        companyName: string;
        currency: string;
        outstandingAmount: Prisma.Decimal;
        overdueAmount: Prisma.Decimal;
        invoiceCount: number;
      }
    >();

    const dueSoonInvoices: {
      id: string;
      invoiceNo: string;
      client: {
        id: string;
        companyName: string;
      };
      currency: string;
      dueDate: Date;
      totalAmount: string;
      outstandingAmount: string;
    }[] = [];

    let overdueInvoiceCount = 0;
    let dueSoonInvoiceCount = 0;

    for (const invoice of invoices) {
      const paid = invoice.payments.reduce(
        (sum, payment) => sum.add(payment.amountPaid),
        new Prisma.Decimal(0),
      );

      const outstanding = Prisma.Decimal.max(
        invoice.totalAmount.sub(paid),
        zero,
      );

      const isOverdue = outstanding.greaterThan(0) && invoice.dueDate < now;

      const isDueSoon =
        outstanding.greaterThan(0) &&
        invoice.dueDate >= now &&
        invoice.dueDate <= dueSoonUntil;

      const summary = currencies.get(invoice.currency) ?? {
        totalInvoiced: new Prisma.Decimal(0),
        totalPaid: new Prisma.Decimal(0),
        totalOutstanding: new Prisma.Decimal(0),
        overdueAmount: new Prisma.Decimal(0),
        dueSoonAmount: new Prisma.Decimal(0),
        invoiceCount: 0,
        overdueCount: 0,
        dueSoonCount: 0,
      };

      summary.totalInvoiced = summary.totalInvoiced.add(invoice.totalAmount);
      summary.totalPaid = summary.totalPaid.add(paid);
      summary.totalOutstanding = summary.totalOutstanding.add(outstanding);
      summary.invoiceCount++;

      if (isOverdue) {
        summary.overdueAmount = summary.overdueAmount.add(outstanding);
        summary.overdueCount++;
        overdueInvoiceCount++;
      }

      if (isDueSoon) {
        summary.dueSoonAmount = summary.dueSoonAmount.add(outstanding);
        summary.dueSoonCount++;
        dueSoonInvoiceCount++;

        dueSoonInvoices.push({
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          client: {
            id: invoice.client.id,
            companyName: invoice.client.companyName,
          },
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          totalAmount: invoice.totalAmount.toString(),
          outstandingAmount: outstanding.toString(),
        });
      }

      if (outstanding.greaterThan(0)) {
        const key = `${invoice.clientId}:${invoice.currency}`;

        const client = clients.get(key) ?? {
          clientId: invoice.client.id,
          clientCode: invoice.client.clientCode,
          companyName: invoice.client.companyName,
          currency: invoice.currency,
          outstandingAmount: new Prisma.Decimal(0),
          overdueAmount: new Prisma.Decimal(0),
          invoiceCount: 0,
        };

        client.outstandingAmount = client.outstandingAmount.add(outstanding);

        if (isOverdue) {
          client.overdueAmount = client.overdueAmount.add(outstanding);
        }

        client.invoiceCount++;
        clients.set(key, client);
      }

      currencies.set(invoice.currency, summary);
    }

    const summaryByCurrency = Array.from(currencies, ([currency, item]) => ({
      currency,
      totalInvoiced: item.totalInvoiced.toString(),
      totalPaid: item.totalPaid.toString(),
      totalOutstanding: item.totalOutstanding.toString(),
      overdueAmount: item.overdueAmount.toString(),
      dueSoonAmount: item.dueSoonAmount.toString(),
      invoiceCount: item.invoiceCount,
      overdueCount: item.overdueCount,
      dueSoonCount: item.dueSoonCount,
    }));

    const topOutstandingClients = Array.from(clients.values())
      .sort((a, b) => {
        if (a.currency !== b.currency) {
          return a.currency.localeCompare(b.currency);
        }

        return b.outstandingAmount.comparedTo(a.outstandingAmount);
      })
      .slice(0, 5)
      .map((client) => ({
        ...client,
        outstandingAmount: client.outstandingAmount.toString(),
        overdueAmount: client.overdueAmount.toString(),
      }));

    dueSoonInvoices.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return {
      asOf: now.toISOString(),
      summary: {
        invoiceCount: invoices.length,
        overdueInvoiceCount,
        dueSoonInvoiceCount,
        byCurrency: summaryByCurrency,
      },
      dueSoonInvoices: dueSoonInvoices.slice(0, 10),
      recentPayments: recentPayments.map((payment) => ({
        ...payment,
        amountPaid: payment.amountPaid.toString(),
      })),
      topOutstandingClients,
    };
  }
}
