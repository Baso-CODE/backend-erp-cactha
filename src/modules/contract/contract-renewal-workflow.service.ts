import { ContractStatus, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContractRenewalDTO } from "./dto/contract-renewal.dto";

@injectable()
export class ContractRenewalWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: AccessScopeService,
  ) {}

  async createDraft(
    sourceContractId: string,
    dto: CreateContractRenewalDTO,
    actorId: string,
  ) {
    const scope = await this.scopes.getPermissionScope(
      actorId,
      "contract.create",
    );

    if (scope !== "ALL" && scope !== "OWN") {
      throw new ApiError("Scope pembuatan kontrak tidak didukung.", 403);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (
      !Number.isFinite(startDate.getTime()) ||
      !Number.isFinite(endDate.getTime()) ||
      endDate <= startDate
    ) {
      throw new ApiError("Periode renewal tidak valid.", 400);
    }

    let value: Prisma.Decimal | undefined;

    if (dto.value !== undefined) {
      value = new Prisma.Decimal(dto.value);

      if (
        !value.isFinite() ||
        value.isNegative() ||
        value.decimalPlaces() > 2 ||
        value.greaterThan("9999999999999.99")
      ) {
        throw new ApiError("Nilai renewal tidak valid.", 400);
      }
    }

    const source = await this.prisma.contract.findFirst({
      where: {
        id: sourceContractId,
        ...(scope === "OWN" && {
          client: { accountManagerId: actorId },
        }),
      },
      select: {
        id: true,
        contractNo: true,
        title: true,
        clientId: true,
        contractType: true,
        startDate: true,
        endDate: true,
        value: true,
        currency: true,
        paymentTerm: true,
        slaTerms: true,
        termsConditions: true,
        renewalReminder: true,
        status: true,
        renewedTo: { select: { id: true } },
      },
    });

    if (!source) {
      throw new ApiError(
        "Kontrak sumber tidak ditemukan atau akses ditolak.",
        404,
      );
    }
    if (
      source.status !== ContractStatus.ACTIVE &&
      source.status !== ContractStatus.EXPIRED
    ) {
      throw new ApiError(
        "Hanya kontrak ACTIVE atau EXPIRED yang dapat diperpanjang.",
        400,
      );
    }
    if (source.renewedTo) {
      throw new ApiError("Kontrak ini sudah memiliki kontrak renewal.", 409);
    }

    if (startDate < source.endDate) {
      throw new ApiError(
        "Tanggal mulai renewal tidak boleh sebelum tanggal akhir kontrak sumber.",
        400,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const counter = await tx.counter.upsert({
          where: { key: "CONTRACT" },
          update: { value: { increment: 1 } },
          create: { key: "CONTRACT", value: 1 },
        });

        const contractNo = `CTR-${String(counter.value).padStart(6, "0")}`;

        const renewal = await tx.contract.create({
          data: {
            contractNo,
            title: dto.title?.trim() || `${source.title} - Renewal`,
            clientId: source.clientId,
            renewedFromId: source.id,
            contractType: source.contractType,
            startDate,
            endDate,
            value: value ?? source.value,
            currency: source.currency,
            paymentTerm: source.paymentTerm,
            slaTerms: source.slaTerms,
            termsConditions: source.termsConditions,
            renewalReminder: source.renewalReminder,
            status: ContractStatus.DRAFT,
          },
          include: {
            client: {
              select: {
                id: true,
                clientCode: true,
                companyName: true,
              },
            },
            renewedFrom: {
              select: {
                id: true,
                contractNo: true,
                title: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "CREATE_RENEWAL_DRAFT",
            entity: "Contract",
            entityId: renewal.id,
            details: {
              sourceContractId: source.id,
              sourceContractNo: source.contractNo,
              renewalContractNo: renewal.contractNo,
              status: renewal.status,
            },
          },
        });

        return {
          ...renewal,
          value: renewal.value.toString(),
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiError(
          "Kontrak ini sudah memiliki renewal atau terjadi konflik nomor kontrak.",
          409,
        );
      }

      throw error;
    }
  }

  async getHistory(contractId: string, actorId: string) {
    const scope = await this.scopes.getPermissionScope(
      actorId,
      "contract.read",
    );

    if (scope !== "ALL" && scope !== "OWN") {
      throw new ApiError("Scope akses kontrak tidak didukung.", 403);
    }

    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        ...(scope === "OWN" && {
          client: { accountManagerId: actorId },
        }),
      },
      select: {
        id: true,
        contractNo: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        renewedFrom: {
          select: {
            id: true,
            contractNo: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        renewedTo: {
          select: {
            id: true,
            contractNo: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!contract) {
      throw new ApiError("Kontrak tidak ditemukan atau akses ditolak.", 404);
    }

    return contract;
  }

  async activateRenewal(renewalId: string, actorId: string) {
    const scope = await this.scopes.getPermissionScope(
      actorId,
      "contract.update",
    );

    if (scope !== "ALL" && scope !== "OWN") {
      throw new ApiError("Scope aktivasi renewal tidak didukung.", 403);
    }

    return this.prisma.$transaction(async (tx) => {
      const renewal = await tx.contract.findFirst({
        where: {
          id: renewalId,
          ...(scope === "OWN" && {
            client: { accountManagerId: actorId },
          }),
        },
        include: {
          renewedFrom: {
            select: {
              id: true,
              contractNo: true,
              clientId: true,
              endDate: true,
              status: true,
            },
          },
        },
      });

      if (!renewal) {
        throw new ApiError(
          "Kontrak renewal tidak ditemukan atau akses ditolak.",
          404,
        );
      }

      if (!renewal.renewedFrom) {
        throw new ApiError("Kontrak ini bukan hasil proses renewal.", 400);
      }

      if (renewal.status !== ContractStatus.DRAFT) {
        throw new ApiError("Hanya draft renewal yang dapat diaktifkan.", 409);
      }

      if (
        renewal.renewedFrom.status !== ContractStatus.ACTIVE &&
        renewal.renewedFrom.status !== ContractStatus.EXPIRED
      ) {
        throw new ApiError(
          "Status kontrak sumber tidak memungkinkan aktivasi renewal.",
          409,
        );
      }

      if (renewal.clientId !== renewal.renewedFrom.clientId) {
        throw new ApiError(
          "Client pada kontrak renewal dan sumber tidak cocok.",
          409,
        );
      }

      if (
        renewal.startDate < renewal.renewedFrom.endDate ||
        renewal.endDate <= renewal.startDate
      ) {
        throw new ApiError("Periode kontrak renewal tidak valid.", 409);
      }

      const now = new Date();

      if (renewal.startDate > now) {
        throw new ApiError(
          "Renewal belum memasuki tanggal mulai kontrak.",
          409,
        );
      }

      if (renewal.endDate <= now) {
        throw new ApiError("Periode kontrak renewal sudah berakhir.", 409);
      }

      if (renewal.renewedFrom.endDate > now) {
        throw new ApiError("Kontrak sumber belum mencapai tanggal akhir.", 409);
      }

      const activeOldBilling = await tx.recurringBilling.count({
        where: {
          contractId: renewal.renewedFrom.id,
          isActive: true,
        },
      });

      if (activeOldBilling > 0) {
        throw new ApiError(
          "Nonaktifkan Recurring Billing kontrak lama sebelum aktivasi renewal.",
          409,
        );
      }

      const update = await tx.contract.updateMany({
        where: {
          id: renewal.id,
          status: ContractStatus.DRAFT,
          renewedFromId: renewal.renewedFrom.id,
        },
        data: {
          status: ContractStatus.ACTIVE,
        },
      });

      if (update.count !== 1) {
        throw new ApiError("Renewal telah diproses oleh request lain.", 409);
      }

      const activated = await tx.contract.findUniqueOrThrow({
        where: { id: renewal.id },
        select: {
          id: true,
          contractNo: true,
          title: true,
          status: true,
          startDate: true,
          endDate: true,
          clientId: true,
          renewedFromId: true,
          value: true,
          currency: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "ACTIVATE_CONTRACT_RENEWAL",
          entity: "Contract",
          entityId: renewal.id,
          details: {
            renewedFromId: renewal.renewedFrom.id,
            renewedFromNo: renewal.renewedFrom.contractNo,
            beforeStatus: ContractStatus.DRAFT,
            afterStatus: activated.status,
            billingCreated: false,
          },
        },
      });

      return {
        ...activated,
        value: activated.value.toString(),
        billingHandoff: {
          required: true,
          contractId: activated.id,
          message:
            "Kontrak aktif. Konfigurasikan Recurring Billing secara terpisah jika diperlukan.",
        },
      };
    });
  }
}
