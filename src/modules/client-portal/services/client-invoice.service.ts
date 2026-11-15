import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryClientInvoiceDTO } from "../dto/query-client-invoice.dto";
import { ClientPortalAccessService } from "./client-portal-access.service";

const VISIBLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
];

@injectable()
export class ClientInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClientPortalAccessService,
  ) {}

  private summary(invoice: {
    totalAmount: Prisma.Decimal;
    dueDate: Date;
    status: InvoiceStatus;
    payments: {
      amountPaid: Prisma.Decimal;
      status: PaymentStatus;
    }[];
  }) {
    const paid = invoice.payments
      .filter((payment) => payment.status === PaymentStatus.VERIFIED)
      .reduce(
        (sum, payment) => sum.add(payment.amountPaid),
        new Prisma.Decimal(0),
      );

    const outstanding = Prisma.Decimal.max(
      invoice.totalAmount.minus(paid),
      new Prisma.Decimal(0),
    );

    const overdue = outstanding.gt(0) && invoice.dueDate.getTime() < Date.now();

    return {
      paidAmount: paid.toString(),
      outstandingAmount: outstanding.toString(),
      isOverdue: overdue,
      paymentStatus: outstanding.eq(0)
        ? "PAID"
        : paid.gt(0)
          ? "PARTIALLY_PAID"
          : overdue
            ? "OVERDUE"
            : "UNPAID",
    };
  }

  async getAll(query: QueryClientInvoiceDTO, actorId: string) {
    const context = await this.access.getClientContext(actorId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter = query.filter ?? "ALL";

    const where: Prisma.InvoiceWhereInput = {
      clientId: context.clientId,
      status: { in: VISIBLE_STATUSES },
      ...(query.search?.trim() && {
        OR: [
          { invoiceNo: { contains: query.search.trim() } },
          {
            contract: {
              title: { contains: query.search.trim() },
            },
          },
        ],
      }),
    };

    // Ambil hanya field yang diperlukan portal.
    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
      select: {
        id: true,
        invoiceNo: true,
        invoiceDate: true,
        dueDate: true,
        currency: true,
        totalAmount: true,
        status: true,
        contract: {
          select: {
            contractNo: true,
            title: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.VERIFIED },
          select: {
            amountPaid: true,
            status: true,
          },
        },
      },
    });

    const rows = invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      status: invoice.status,
      contract: invoice.contract,
      totalAmount: invoice.totalAmount.toString(),
      ...this.summary(invoice),
    }));

    const filtered = rows.filter((invoice) => {
      if (filter === "PAID") {
        return invoice.paymentStatus === "PAID";
      }

      if (filter === "OVERDUE") {
        return invoice.isOverdue;
      }

      if (filter === "OUTSTANDING") {
        return new Prisma.Decimal(invoice.outstandingAmount).gt(0);
      }

      return true;
    });

    const total = filtered.length;
    const start = (page - 1) * limit;

    return {
      data: filtered.slice(start, start + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(invoiceId: string, actorId: string) {
    const context = await this.access.getClientContext(actorId);

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId: context.clientId,
        status: { in: VISIBLE_STATUSES },
      },
      select: {
        id: true,
        invoiceNo: true,
        invoiceDate: true,
        dueDate: true,
        currency: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
        status: true,
        fileUrl: true,
        notes: true,
        contract: {
          select: {
            contractNo: true,
            title: true,
          },
        },
        project: {
          select: {
            projectCode: true,
            name: true,
          },
        },
        items: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.VERIFIED },
          orderBy: { paymentDate: "desc" },
          select: {
            id: true,
            paymentNo: true,
            paymentDate: true,
            amountPaid: true,
            paymentMethod: true,
            status: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new ApiError(
        "Invoice tidak ditemukan atau tidak dapat diakses.",
        404,
      );
    }

    return {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      status: invoice.status,
      fileUrl: invoice.fileUrl,
      notes: invoice.notes,
      contract: invoice.contract,
      project: invoice.project,
      subtotal: invoice.subtotal.toString(),
      discountAmount: invoice.discountAmount.toString(),
      taxAmount: invoice.taxAmount.toString(),
      totalAmount: invoice.totalAmount.toString(),
      items: invoice.items.map((item) => ({
        ...item,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
      })),
      payments: invoice.payments.map((payment) => ({
        ...payment,
        amountPaid: payment.amountPaid.toString(),
      })),
      ...this.summary(invoice),
    };
  }
}
