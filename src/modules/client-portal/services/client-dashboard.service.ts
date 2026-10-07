import {
  ApprovalStatus,
  InvoiceStatus,
  PaymentStatus,
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
              InvoiceStatus.UNPAID,
              InvoiceStatus.PARTIAL,
              InvoiceStatus.OVERDUE,
            ],
          },
        },
        select: {
          id: true,
          amount: true,
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

    const outstandingInvoices = invoices.length;

    const overdueInvoices = invoices.filter(
      (invoice) =>
        invoice.status === InvoiceStatus.OVERDUE ||
        invoice.dueDate < new Date(),
    ).length;

    const outstandingAmount = invoices.reduce((total, invoice) => {
      const paid = invoice.payments.reduce(
        (paymentTotal, payment) => paymentTotal + Number(payment.amountPaid),
        0,
      );

      const balance = Math.max(Number(invoice.amount) - paid, 0);

      return total + balance;
    }, 0);

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
