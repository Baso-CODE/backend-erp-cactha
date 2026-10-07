import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentDTO } from "./dto/create-payment.dto";
import { QueryPaymentDTO } from "./dto/query-payment.dto";
import { RejectPaymentDTO } from "./dto/reject-payment.dto";
import { UpdatePaymentDTO } from "./dto/update-payment.dto";

@injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async getAccessibleInvoice(
    invoiceId: string,
    actorId: string,
    permission: string,
  ) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
      include: {
        payments: {
          where: {
            status: PaymentStatus.VERIFIED,
          },
          select: {
            amountPaid: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new ApiError(
        "Invoice tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    return invoice;
  }

  private calculateVerifiedAmount(
    payments: {
      amountPaid: Prisma.Decimal;
    }[],
  ) {
    return payments.reduce(
      (total, payment) => total.add(payment.amountPaid),
      new Prisma.Decimal(0),
    );
  }

  private getOutstandingAmount(
    totalAmount: Prisma.Decimal,
    verifiedAmount: Prisma.Decimal,
  ) {
    return Prisma.Decimal.max(
      totalAmount.sub(verifiedAmount),
      new Prisma.Decimal(0),
    );
  }

  private async recalculateInvoiceStatus(
    tx: Prisma.TransactionClient,
    invoiceId: string,
  ) {
    const invoice = await tx.invoice.findUnique({
      where: {
        id: invoiceId,
      },
      include: {
        payments: {
          where: {
            status: PaymentStatus.VERIFIED,
          },
          select: {
            amountPaid: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new ApiError("Invoice tidak ditemukan.", 404);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ApiError(
        "Invoice CANCELLED tidak dapat menerima pembayaran.",
        400,
      );
    }

    const verifiedAmount = this.calculateVerifiedAmount(invoice.payments);

    let status: InvoiceStatus;
    let paidAt: Date | null = invoice.paidAt;

    if (verifiedAmount.greaterThanOrEqualTo(invoice.totalAmount)) {
      status = InvoiceStatus.PAID;
      paidAt = invoice.paidAt ?? new Date();
    } else if (verifiedAmount.greaterThan(0)) {
      status = InvoiceStatus.PARTIALLY_PAID;
      paidAt = null;
    } else {
      status = InvoiceStatus.SENT;
      paidAt = null;
    }

    return tx.invoice.update({
      where: {
        id: invoiceId,
      },
      data: {
        status,
        paidAt,
      },
    });
  }

  async getAllPayments(query: QueryPaymentDTO, actorId: string) {
    const {
      search,
      status,
      paymentMethod,
      invoiceId,
      clientId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "payment.read",
    );

    const accessFilter: Prisma.PaymentWhereInput =
      scope === "ALL"
        ? {}
        : {
            invoice: {
              client: {
                accountManagerId: actorId,
              },
            },
          };

    const where: Prisma.PaymentWhereInput = {
      AND: [
        accessFilter,
        {
          ...(status && {
            status,
          }),
          ...(paymentMethod && {
            paymentMethod,
          }),
          ...(invoiceId && {
            invoiceId,
          }),
          ...(clientId && {
            invoice: {
              clientId,
            },
          }),
          ...((dateFrom || dateTo) && {
            paymentDate: {
              ...(dateFrom && {
                gte: new Date(dateFrom),
              }),
              ...(dateTo && {
                lte: new Date(dateTo),
              }),
            },
          }),
          ...(search && {
            OR: [
              {
                paymentNo: {
                  contains: search,
                },
              },
              {
                reference: {
                  contains: search,
                },
              },
              {
                invoice: {
                  invoiceNo: {
                    contains: search,
                  },
                },
              },
              {
                invoice: {
                  client: {
                    companyName: {
                      contains: search,
                    },
                  },
                },
              },
            ],
          }),
        },
      ],
    };

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            paymentDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              totalAmount: true,
              currency: true,
              status: true,
              client: {
                select: {
                  id: true,
                  clientCode: true,
                  companyName: true,
                },
              },
            },
          },
          verifiedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      this.prisma.payment.count({
        where,
      }),
    ]);

    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentById(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "payment.read",
    );

    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          invoice: {
            client: {
              accountManagerId: actorId,
            },
          },
        }),
      },
      include: {
        invoice: {
          include: {
            client: {
              select: {
                id: true,
                clientCode: true,
                companyName: true,
                status: true,
              },
            },
            contract: {
              select: {
                id: true,
                contractNo: true,
                title: true,
              },
            },
            project: {
              select: {
                id: true,
                projectCode: true,
                name: true,
              },
            },
          },
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!payment) {
      throw new ApiError(
        "Payment tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    return payment;
  }

  async createPayment(data: CreatePaymentDTO, actorId: string) {
    const invoice = await this.getAccessibleInvoice(
      data.invoiceId,
      actorId,
      "payment.create",
    );

    const payableStatuses = new Set<InvoiceStatus>([
      InvoiceStatus.SENT,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.OVERDUE,
    ]);

    if (!payableStatuses.has(invoice.status)) {
      throw new ApiError(
        "Payment hanya dapat dibuat untuk invoice yang sudah dikirim dan belum lunas.",
        400,
      );
    }

    const amountPaid = new Prisma.Decimal(data.amountPaid);

    if (amountPaid.lessThanOrEqualTo(0)) {
      throw new ApiError("Jumlah pembayaran harus lebih besar dari 0.", 400);
    }

    const verifiedAmount = this.calculateVerifiedAmount(invoice.payments);

    const outstandingAmount = this.getOutstandingAmount(
      invoice.totalAmount,
      verifiedAmount,
    );

    if (outstandingAmount.lessThanOrEqualTo(0)) {
      throw new ApiError("Invoice sudah lunas.", 400);
    }

    if (amountPaid.greaterThan(outstandingAmount)) {
      throw new ApiError(
        `Jumlah pembayaran melebihi outstanding invoice sebesar ${outstandingAmount.toString()}.`,
        400,
      );
    }

    const paymentDate = new Date(data.paymentDate);

    if (Number.isNaN(paymentDate.getTime())) {
      throw new ApiError("Tanggal pembayaran tidak valid.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const year = paymentDate.getUTCFullYear();

      const counter = await tx.counter.upsert({
        where: {
          key: `PAYMENT_${year}`,
        },
        update: {
          value: {
            increment: 1,
          },
        },
        create: {
          key: `PAYMENT_${year}`,
          value: 1,
        },
      });

      const paymentNo = `PAY-${year}-${String(counter.value).padStart(6, "0")}`;

      const payment = await tx.payment.create({
        data: {
          paymentNo,
          invoiceId: data.invoiceId,
          amountPaid,
          paymentDate,
          paymentMethod: data.paymentMethod,
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
          proofUrl: data.proofUrl?.trim() || null,
          status: PaymentStatus.PENDING,
        },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNo: true,
              totalAmount: true,
              currency: true,
              status: true,
              client: {
                select: {
                  id: true,
                  clientCode: true,
                  companyName: true,
                },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Payment",
          entityId: payment.id,
          details: {
            paymentNo: payment.paymentNo,
            invoiceId: payment.invoiceId,
            amountPaid: payment.amountPaid.toString(),
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            reference: payment.reference,
            status: payment.status,
          },
        },
      });

      return payment;
    });
  }

  async updatePayment(id: string, data: UpdatePaymentDTO, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "payment.update",
    );

    const existing = await this.prisma.payment.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          invoice: {
            client: {
              accountManagerId: actorId,
            },
          },
        }),
      },
      include: {
        invoice: {
          include: {
            payments: {
              where: {
                status: PaymentStatus.VERIFIED,
              },
              select: {
                amountPaid: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError(
        "Payment tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    if (existing.status !== PaymentStatus.PENDING) {
      throw new ApiError("Hanya payment PENDING yang dapat diubah.", 400);
    }

    const amountPaid =
      data.amountPaid !== undefined
        ? new Prisma.Decimal(data.amountPaid)
        : existing.amountPaid;

    if (amountPaid.lessThanOrEqualTo(0)) {
      throw new ApiError("Jumlah pembayaran harus lebih besar dari 0.", 400);
    }

    const verifiedAmount = this.calculateVerifiedAmount(
      existing.invoice.payments,
    );

    const outstandingAmount = this.getOutstandingAmount(
      existing.invoice.totalAmount,
      verifiedAmount,
    );

    if (amountPaid.greaterThan(outstandingAmount)) {
      throw new ApiError(
        `Jumlah pembayaran melebihi outstanding invoice sebesar ${outstandingAmount.toString()}.`,
        400,
      );
    }

    const paymentDate =
      data.paymentDate !== undefined
        ? new Date(data.paymentDate)
        : existing.paymentDate;

    if (Number.isNaN(paymentDate.getTime())) {
      throw new ApiError("Tanggal pembayaran tidak valid.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: {
          id,
        },
        data: {
          amountPaid,
          paymentDate,
          ...(data.paymentMethod !== undefined && {
            paymentMethod: data.paymentMethod,
          }),
          ...(data.reference !== undefined && {
            reference: data.reference.trim() || null,
          }),
          ...(data.notes !== undefined && {
            notes: data.notes.trim() || null,
          }),
          ...(data.proofUrl !== undefined && {
            proofUrl: data.proofUrl.trim() || null,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "Payment",
          entityId: id,
          details: {
            before: {
              amountPaid: existing.amountPaid.toString(),
              paymentDate: existing.paymentDate,
              paymentMethod: existing.paymentMethod,
              reference: existing.reference,
              status: existing.status,
            },
            after: {
              amountPaid: updated.amountPaid.toString(),
              paymentDate: updated.paymentDate,
              paymentMethod: updated.paymentMethod,
              reference: updated.reference,
              status: updated.status,
            },
          },
        },
      });

      return updated;
    });
  }

  async verifyPayment(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "payment.verify",
    );

    return this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findFirst({
          where: {
            id,
            ...(scope !== "ALL" && {
              invoice: {
                client: {
                  accountManagerId: actorId,
                },
              },
            }),
          },
          include: {
            invoice: {
              include: {
                payments: {
                  where: {
                    status: PaymentStatus.VERIFIED,
                  },
                  select: {
                    id: true,
                    amountPaid: true,
                  },
                },
              },
            },
          },
        });

        if (!payment) {
          throw new ApiError(
            "Payment tidak ditemukan atau Anda tidak memiliki akses.",
            404,
          );
        }

        if (payment.status !== PaymentStatus.PENDING) {
          throw new ApiError(
            "Hanya payment PENDING yang dapat diverifikasi.",
            400,
          );
        }

        if (payment.invoice.status === InvoiceStatus.CANCELLED) {
          throw new ApiError(
            "Payment tidak dapat diverifikasi karena invoice sudah dibatalkan.",
            400,
          );
        }

        if (payment.invoice.status === InvoiceStatus.DRAFT) {
          throw new ApiError(
            "Payment tidak dapat diverifikasi untuk invoice DRAFT.",
            400,
          );
        }

        const verifiedAmount = this.calculateVerifiedAmount(
          payment.invoice.payments,
        );

        const totalAfterVerification = verifiedAmount.add(payment.amountPaid);

        if (totalAfterVerification.greaterThan(payment.invoice.totalAmount)) {
          throw new ApiError(
            "Payment tidak dapat diverifikasi karena menyebabkan overpayment.",
            400,
          );
        }

        const verified = await tx.payment.update({
          where: {
            id,
          },
          data: {
            status: PaymentStatus.VERIFIED,
            verifiedById: actorId,
            verifiedAt: new Date(),
            rejectedAt: null,
            rejectionReason: null,
          },
        });

        const invoice = await this.recalculateInvoiceStatus(
          tx,
          payment.invoiceId,
        );

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "VERIFY",
            entity: "Payment",
            entityId: id,
            details: {
              paymentNo: verified.paymentNo,
              invoiceId: verified.invoiceId,
              amountPaid: verified.amountPaid.toString(),
              fromStatus: payment.status,
              toStatus: verified.status,
              invoiceStatus: invoice.status,
              verifiedAt: verified.verifiedAt,
            },
          },
        });

        return {
          payment: verified,
          invoice,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async rejectPayment(id: string, data: RejectPaymentDTO, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "payment.reject",
    );

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          id,
          ...(scope !== "ALL" && {
            invoice: {
              client: {
                accountManagerId: actorId,
              },
            },
          }),
        },
      });

      if (!payment) {
        throw new ApiError(
          "Payment tidak ditemukan atau Anda tidak memiliki akses.",
          404,
        );
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new ApiError("Hanya payment PENDING yang dapat ditolak.", 400);
      }

      const rejected = await tx.payment.update({
        where: {
          id,
        },
        data: {
          status: PaymentStatus.REJECTED,
          rejectionReason: data.rejectionReason.trim(),
          rejectedAt: new Date(),
          verifiedAt: null,
          verifiedById: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "REJECT",
          entity: "Payment",
          entityId: id,
          details: {
            paymentNo: rejected.paymentNo,
            invoiceId: rejected.invoiceId,
            amountPaid: rejected.amountPaid.toString(),
            fromStatus: payment.status,
            toStatus: rejected.status,
            rejectionReason: rejected.rejectionReason,
            rejectedAt: rejected.rejectedAt,
          },
        },
      });

      return rejected;
    });
  }
}
