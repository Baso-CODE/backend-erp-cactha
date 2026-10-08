import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInvoiceDTO } from "./dto/create-invoice.dto";
import { QueryInvoiceDTO } from "./dto/query-invoice.dto";
import { UpdateInvoiceDTO } from "./dto/update-invoice.dto";

@injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private buildPaymentSummary(
    totalAmount: Prisma.Decimal,
    dueDate: Date,
    status: string,
    payments: {
      amountPaid: Prisma.Decimal;
      status: string;
    }[],
  ) {
    const paidAmount = payments
      .filter((payment) => payment.status === "VERIFIED")
      .reduce(
        (total, payment) => total.add(payment.amountPaid),
        new Prisma.Decimal(0),
      );

    const outstandingAmount = Prisma.Decimal.max(
      totalAmount.sub(paidAmount),
      new Prisma.Decimal(0),
    );

    const isOverdue =
      outstandingAmount.greaterThan(0) &&
      dueDate.getTime() < new Date().getTime() &&
      !["DRAFT", "CANCELLED"].includes(status);

    return {
      paidAmount: paidAmount.toString(),
      outstandingAmount: outstandingAmount.toString(),
      isOverdue,
    };
  }

  private async getAccessibleClient(
    clientId: string,
    actorId: string,
    permission: string,
  ) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        ...(scope !== "ALL" && {
          accountManagerId: actorId,
        }),
      },
      select: {
        id: true,
        clientCode: true,
        companyName: true,
        status: true,
        accountManagerId: true,
      },
    });

    if (!client) {
      throw new ApiError(
        "Client tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    return client;
  }

  private calculateInvoiceAmounts(data: {
    items: {
      description: string;
      quantity: string;
      unitPrice: string;
    }[];
    discountAmount?: string;
    taxAmount?: string;
  }) {
    const items = data.items.map((item, index) => {
      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = new Prisma.Decimal(item.unitPrice);

      if (quantity.lessThanOrEqualTo(0)) {
        throw new ApiError(
          `Quantity item ke-${index + 1} harus lebih besar dari 0.`,
          400,
        );
      }

      if (unitPrice.lessThan(0)) {
        throw new ApiError(
          `Unit price item ke-${index + 1} tidak boleh negatif.`,
          400,
        );
      }

      const lineTotal = quantity.mul(unitPrice);

      return {
        description: item.description.trim(),
        quantity,
        unitPrice,
        lineTotal,
        position: index,
      };
    });

    const subtotal = items.reduce(
      (total, item) => total.add(item.lineTotal),
      new Prisma.Decimal(0),
    );

    const discountAmount = new Prisma.Decimal(data.discountAmount ?? "0");

    const taxAmount = new Prisma.Decimal(data.taxAmount ?? "0");

    if (discountAmount.lessThan(0)) {
      throw new ApiError("Discount amount tidak boleh negatif.", 400);
    }

    if (taxAmount.lessThan(0)) {
      throw new ApiError("Tax amount tidak boleh negatif.", 400);
    }

    if (discountAmount.greaterThan(subtotal)) {
      throw new ApiError(
        "Discount amount tidak boleh lebih besar dari subtotal.",
        400,
      );
    }

    const totalAmount = subtotal.sub(discountAmount).add(taxAmount);

    if (totalAmount.lessThanOrEqualTo(0)) {
      throw new ApiError("Total invoice harus lebih besar dari 0.", 400);
    }

    return {
      items,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    };
  }
  private async validateInvoiceRelations(
    clientId: string,
    contractId?: string,
    projectId?: string,
  ) {
    let resolvedContractId = contractId ?? null;

    if (contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: {
          id: contractId,
          clientId,
        },
        select: {
          id: true,
          contractNo: true,
          clientId: true,
          status: true,
        },
      });

      if (!contract) {
        throw new ApiError(
          "Contract tidak ditemukan atau bukan milik client yang dipilih.",
          400,
        );
      }
    }

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          clientId,
        },
        select: {
          id: true,
          projectCode: true,
          clientId: true,
          contractId: true,
          status: true,
        },
      });

      if (!project) {
        throw new ApiError(
          "Project tidak ditemukan atau bukan milik client yang dipilih.",
          400,
        );
      }

      if (
        contractId &&
        project.contractId &&
        project.contractId !== contractId
      ) {
        throw new ApiError(
          "Project tidak terhubung dengan contract yang dipilih.",
          400,
        );
      }

      if (!contractId && project.contractId) {
        resolvedContractId = project.contractId;
      }
    }

    return {
      contractId: resolvedContractId,
      projectId: projectId ?? null,
    };
  }

  private validateInvoiceDates(invoiceDate: Date, dueDate: Date) {
    if (
      Number.isNaN(invoiceDate.getTime()) ||
      Number.isNaN(dueDate.getTime())
    ) {
      throw new ApiError("Tanggal invoice tidak valid.", 400);
    }

    if (dueDate < invoiceDate) {
      throw new ApiError("Due date tidak boleh sebelum invoice date.", 400);
    }
  }

  async createInvoice(data: CreateInvoiceDTO, actorId: string) {
    await this.getAccessibleClient(data.clientId, actorId, "invoice.create");

    const invoiceDate = new Date(data.invoiceDate);

    const dueDate = new Date(data.dueDate);

    this.validateInvoiceDates(invoiceDate, dueDate);

    const relations = await this.validateInvoiceRelations(
      data.clientId,
      data.contractId,
      data.projectId,
    );

    const amounts = this.calculateInvoiceAmounts(data);

    return this.prisma.$transaction(async (tx) => {
      const year = invoiceDate.getUTCFullYear();

      const counter = await tx.counter.upsert({
        where: {
          key: `INVOICE_${year}`,
        },
        update: {
          value: {
            increment: 1,
          },
        },
        create: {
          key: `INVOICE_${year}`,
          value: 1,
        },
      });

      const invoiceNo = `INV-${year}-${String(counter.value).padStart(6, "0")}`;

      const invoice = await tx.invoice.create({
        data: {
          invoiceNo,
          clientId: data.clientId,
          contractId: relations.contractId,
          projectId: relations.projectId,
          invoiceDate,
          dueDate,
          currency: data.currency ?? "IDR",
          subtotal: amounts.subtotal,
          discountAmount: amounts.discountAmount,
          taxAmount: amounts.taxAmount,
          totalAmount: amounts.totalAmount,
          notes: data.notes?.trim() || null,
          status: "DRAFT",
          items: {
            create: amounts.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              position: item.position,
            })),
          },
        },
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
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
          items: {
            orderBy: {
              position: "asc",
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Invoice",
          entityId: invoice.id,
          details: {
            invoiceNo: invoice.invoiceNo,
            clientId: invoice.clientId,
            contractId: invoice.contractId,
            projectId: invoice.projectId,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            currency: invoice.currency,
            subtotal: invoice.subtotal.toString(),
            discountAmount: invoice.discountAmount.toString(),
            taxAmount: invoice.taxAmount.toString(),
            totalAmount: invoice.totalAmount.toString(),
            status: invoice.status,
            itemCount: invoice.items.length,
          },
        },
      });

      return invoice;
    });
  }

  async updateInvoice(id: string, data: UpdateInvoiceDTO, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.update",
    );

    const existing = await this.prisma.invoice.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
      include: {
        items: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError(
        "Invoice tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    const allocationCount = await this.prisma.invoiceRevenueAllocation.count({
      where: { invoiceId: id },
    });

    if (allocationCount > 0) {
      throw new ApiError(
        "Invoice sudah memiliki Revenue Allocation. Hapus alokasi terlebih dahulu sebelum mengubah Invoice.",
        409,
      );
    }

    const targetClientId = data.clientId ?? existing.clientId;

    if (data.clientId !== undefined && data.clientId !== existing.clientId) {
      await this.getAccessibleClient(data.clientId, actorId, "invoice.update");
    }

    const targetContractId =
      data.contractId ?? existing.contractId ?? undefined;

    const targetProjectId = data.projectId ?? existing.projectId ?? undefined;

    const relations = await this.validateInvoiceRelations(
      targetClientId,
      targetContractId,
      targetProjectId,
    );

    const invoiceDate = data.invoiceDate
      ? new Date(data.invoiceDate)
      : existing.invoiceDate;

    const dueDate = data.dueDate ? new Date(data.dueDate) : existing.dueDate;

    this.validateInvoiceDates(invoiceDate, dueDate);

    const targetItems = data.items
      ? data.items
      : existing.items.map((item) => ({
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
        }));

    const amounts = this.calculateInvoiceAmounts({
      items: targetItems,
      discountAmount: data.discountAmount ?? existing.discountAmount.toString(),
      taxAmount: data.taxAmount ?? existing.taxAmount.toString(),
    });

    return this.prisma.$transaction(async (tx) => {
      if (data.items !== undefined) {
        await tx.invoiceItem.deleteMany({
          where: {
            invoiceId: id,
          },
        });
      }

      const updated = await tx.invoice.update({
        where: {
          id,
        },
        data: {
          clientId: targetClientId,
          contractId: relations.contractId,
          projectId: relations.projectId,
          invoiceDate,
          dueDate,
          currency: data.currency ?? existing.currency,
          subtotal: amounts.subtotal,
          discountAmount: amounts.discountAmount,
          taxAmount: amounts.taxAmount,
          totalAmount: amounts.totalAmount,
          ...(data.notes !== undefined && {
            notes: data.notes.trim() || null,
          }),
          ...(data.items !== undefined && {
            items: {
              create: amounts.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
                position: item.position,
              })),
            },
          }),
        },
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
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
          items: {
            orderBy: {
              position: "asc",
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "Invoice",
          entityId: id,
          details: {
            before: {
              clientId: existing.clientId,
              contractId: existing.contractId,
              projectId: existing.projectId,
              invoiceDate: existing.invoiceDate,
              dueDate: existing.dueDate,
              currency: existing.currency,
              subtotal: existing.subtotal.toString(),
              discountAmount: existing.discountAmount.toString(),
              taxAmount: existing.taxAmount.toString(),
              totalAmount: existing.totalAmount.toString(),
              status: existing.status,
            },
            after: {
              clientId: updated.clientId,
              contractId: updated.contractId,
              projectId: updated.projectId,
              invoiceDate: updated.invoiceDate,
              dueDate: updated.dueDate,
              currency: updated.currency,
              subtotal: updated.subtotal.toString(),
              discountAmount: updated.discountAmount.toString(),
              taxAmount: updated.taxAmount.toString(),
              totalAmount: updated.totalAmount.toString(),
              status: updated.status,
            },
          },
        },
      });

      return updated;
    });
  }

  async getAllInvoices(query: QueryInvoiceDTO, actorId: string) {
    const {
      search,
      status,
      clientId,
      contractId,
      projectId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.read",
    );

    const accessFilter: Prisma.InvoiceWhereInput =
      scope === "ALL"
        ? {}
        : {
            client: {
              accountManagerId: actorId,
            },
          };

    const where: Prisma.InvoiceWhereInput = {
      AND: [
        accessFilter,
        {
          ...(status && {
            status,
          }),
          ...(clientId && {
            clientId,
          }),
          ...(contractId && {
            contractId,
          }),
          ...(projectId && {
            projectId,
          }),
          ...((dateFrom || dateTo) && {
            invoiceDate: {
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
                invoiceNo: {
                  contains: search,
                },
              },
              {
                client: {
                  companyName: {
                    contains: search,
                  },
                },
              },
              {
                client: {
                  clientCode: {
                    contains: search,
                  },
                },
              },
              {
                contract: {
                  contractNo: {
                    contains: search,
                  },
                },
              },
              {
                project: {
                  projectCode: {
                    contains: search,
                  },
                },
              },
              {
                project: {
                  name: {
                    contains: search,
                  },
                },
              },
            ],
          }),
        },
      ],
    };

    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            invoiceDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
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
              status: true,
            },
          },
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
              status: true,
            },
          },
          payments: {
            where: {
              status: "VERIFIED",
            },
            select: {
              amountPaid: true,
              status: true,
            },
          },
          _count: {
            select: {
              items: true,
              payments: true,
            },
          },
        },
      }),

      this.prisma.invoice.count({
        where,
      }),
    ]);

    const data = invoices.map(({ payments, ...invoice }) => {
      const paymentSummary = this.buildPaymentSummary(
        invoice.totalAmount,
        invoice.dueDate,
        invoice.status,
        payments,
      );

      return {
        ...invoice,
        ...paymentSummary,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getInvoiceById(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.read",
    );

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
      include: {
        client: {
          select: {
            id: true,
            clientCode: true,
            companyName: true,
            industry: true,
            businessType: true,
            website: true,
            address: true,
            status: true,
            accountManager: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        contract: {
          select: {
            id: true,
            contractNo: true,
            title: true,
            contractType: true,
            startDate: true,
            endDate: true,
            value: true,
            currency: true,
            status: true,
          },
        },
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            projectType: true,
            startDate: true,
            targetEndDate: true,
            status: true,
          },
        },
        items: {
          orderBy: {
            position: "asc",
          },
        },
        payments: {
          orderBy: [
            {
              paymentDate: "desc",
            },
            {
              createdAt: "desc",
            },
          ],
          include: {
            verifiedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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

    const paymentSummary = this.buildPaymentSummary(
      invoice.totalAmount,
      invoice.dueDate,
      invoice.status,
      invoice.payments,
    );
    return {
      ...invoice,
      ...paymentSummary,
    };
  }

  async sendInvoice(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.update",
    );

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
    });

    if (!invoice) {
      throw new ApiError(
        "Invoice tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    if (invoice.status !== "DRAFT") {
      throw new ApiError("Hanya invoice DRAFT yang dapat dikirim.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: {
          id,
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "SEND",
          entity: "Invoice",
          entityId: id,
          details: {
            invoiceNo: invoice.invoiceNo,
            fromStatus: invoice.status,
            toStatus: updated.status,
            sentAt: updated.sentAt,
          },
        },
      });

      return updated;
    });
  }

  async cancelInvoice(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.update",
    );

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
      include: {
        payments: {
          where: {
            status: "VERIFIED",
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!invoice) {
      throw new ApiError(
        "Invoice tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    if (!["DRAFT", "SENT", "OVERDUE"].includes(invoice.status)) {
      throw new ApiError(
        "Invoice dengan status ini tidak dapat dibatalkan.",
        400,
      );
    }

    if (invoice.payments.length > 0) {
      throw new ApiError(
        "Invoice yang sudah memiliki pembayaran terverifikasi tidak dapat dibatalkan.",
        400,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: {
          id,
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CANCEL",
          entity: "Invoice",
          entityId: id,
          details: {
            invoiceNo: invoice.invoiceNo,
            fromStatus: invoice.status,
            toStatus: updated.status,
            cancelledAt: updated.cancelledAt,
          },
        },
      });

      return updated;
    });
  }

  async deleteInvoice(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.delete",
    );

    const existing = await this.prisma.invoice.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
      include: {
        items: true,
        payments: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError(
        "Invoice tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    if (existing.status !== "DRAFT") {
      throw new ApiError("Hanya invoice DRAFT yang dapat dihapus.", 400);
    }

    if (existing.payments.length > 0) {
      throw new ApiError(
        "Invoice yang sudah memiliki data pembayaran tidak dapat dihapus.",
        400,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.delete({
        where: {
          id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Invoice",
          entityId: id,
          details: {
            invoiceNo: existing.invoiceNo,
            clientId: existing.clientId,
            contractId: existing.contractId,
            projectId: existing.projectId,
            invoiceDate: existing.invoiceDate,
            dueDate: existing.dueDate,
            currency: existing.currency,
            subtotal: existing.subtotal.toString(),
            discountAmount: existing.discountAmount.toString(),
            taxAmount: existing.taxAmount.toString(),
            totalAmount: existing.totalAmount.toString(),
            status: existing.status,
            itemCount: existing.items.length,
          },
        },
      });
    });

    return {
      message: `Invoice "${existing.invoiceNo}" berhasil dihapus.`,
    };
  }
}
