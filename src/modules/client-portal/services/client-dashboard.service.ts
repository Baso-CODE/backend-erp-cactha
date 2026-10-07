import {
  ApprovalStatus,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  ProjectStatus,
} from "@prisma/client";
import { injectable } from "tsyringe";

import { PrismaService } from "../../prisma/prisma.service";
import { ClientPortalAccessService } from "./client-portal-access.service";

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.INTERNAL_REVIEW,
  ProjectStatus.PENDING_CLIENT_APPROVAL,
  ProjectStatus.CLIENT_REVISION,
  ProjectStatus.APPROVED,
  ProjectStatus.ON_HOLD,
];

@injectable()
export class ClientDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientPortalAccessService: ClientPortalAccessService,
  ) {}

  async getDashboard(actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    const clientId = context.clientId;

    const [
      totalProjects,
      activeProjects,
      completedProjects,
      pendingApprovals,
      readyDeliverables,
      openSupportTickets,
      invoices,
      recentProjects,
    ] = await Promise.all([
      this.prisma.project.count({
        where: { clientId },
      }),

      this.prisma.project.count({
        where: {
          clientId,
          status: {
            in: ACTIVE_PROJECT_STATUSES,
          },
        },
      }),

      this.prisma.project.count({
        where: {
          clientId,
          status: ProjectStatus.COMPLETED,
        },
      }),

      this.prisma.approvalRequest.count({
        where: {
          clientId,
          status: ApprovalStatus.PENDING_CLIENT_APPROVAL,
        },
      }),

      this.prisma.deliverable.count({
        where: {
          project: {
            clientId,
          },
          status: {
            in: [
              ApprovalStatus.READY_FOR_CLIENT,
              ApprovalStatus.PENDING_CLIENT_APPROVAL,
            ],
          },
        },
      }),

      this.prisma.supportTicket.count({
        where: {
          clientId,
          status: {
            in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"],
          },
        },
      }),

      this.prisma.invoice.findMany({
        where: {
          clientId,
          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.OVERDUE,
            ],
          },
        },
        select: {
          id: true,
          totalAmount: true,
          status: true,
          dueDate: true,
          payments: {
            where: {
              status: PaymentStatus.VERIFIED,
            },
            select: {
              amountPaid: true,
            },
          },
        },
      }),

      this.prisma.project.findMany({
        where: {
          clientId,
        },
        take: 5,
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          projectCode: true,
          name: true,
          projectType: true,
          status: true,
          startDate: true,
          targetEndDate: true,
          updatedAt: true,
          projectManager: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              services: true,
              deliverables: true,
            },
          },
        },
      }),
    ]);

    const now = new Date();

    const invoiceSummaries = invoices.map((invoice) => {
      const paidAmount = invoice.payments.reduce(
        (total, payment) => total.add(payment.amountPaid),
        new Prisma.Decimal(0),
      );

      const outstandingAmount = Prisma.Decimal.max(
        invoice.totalAmount.sub(paidAmount),
        new Prisma.Decimal(0),
      );
      const nonOverdueStatuses = new Set<InvoiceStatus>([
        InvoiceStatus.DRAFT,
        InvoiceStatus.CANCELLED,
        InvoiceStatus.PAID,
      ]);

      const isOverdue =
        outstandingAmount.greaterThan(0) &&
        invoice.dueDate < now &&
        !nonOverdueStatuses.has(invoice.status);

      return {
        outstandingAmount,
        isOverdue,
      };
    });

    const outstandingInvoices = invoiceSummaries.filter((invoice) =>
      invoice.outstandingAmount.greaterThan(0),
    ).length;

    const overdueInvoices = invoiceSummaries.filter(
      (invoice) => invoice.isOverdue,
    ).length;

    const outstandingAmount = invoiceSummaries
      .reduce(
        (total, invoice) => total.add(invoice.outstandingAmount),
        new Prisma.Decimal(0),
      )
      .toString();

    return {
      client: {
        id: context.client.id,
        clientCode: context.client.clientCode,
        companyName: context.client.companyName,
      },

      contact: {
        id: context.contactId,
        name: context.contactName,
        email: context.contactEmail,
        isPrimary: context.isPrimaryContact,
      },

      summary: {
        projects: {
          total: totalProjects,
          active: activeProjects,
          completed: completedProjects,
        },

        approvals: {
          pending: pendingApprovals,
        },

        deliverables: {
          readyForClient: readyDeliverables,
        },

        invoices: {
          outstanding: outstandingInvoices,
          overdue: overdueInvoices,
          outstandingAmount,
        },

        support: {
          open: openSupportTickets,
        },
      },

      recentProjects,
    };
  }
}
