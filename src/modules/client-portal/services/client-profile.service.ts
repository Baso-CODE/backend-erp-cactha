import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { ClientPortalAccessService } from "./client-portal-access.service";

@injectable()
export class ClientProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientPortalAccessService: ClientPortalAccessService,
  ) {}

  async getProfile(actorId: string) {
    await this.clientPortalAccessService.getClientContext(actorId);

    const [user, contact] = await Promise.all([
      this.prisma.user.findUnique({
        where: {
          id: actorId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      }),

      this.prisma.contactPerson.findUnique({
        where: {
          userId: actorId,
        },
        select: {
          id: true,
          fullName: true,
          position: true,
          department: true,
          email: true,
          phone: true,
          mobile: true,
          isPrimary: true,
          status: true,
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
            },
          },
        },
      }),
    ]);

    if (!user || !contact) {
      throw new ApiError("Profile client portal tidak ditemukan.", 404);
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: contact.mobile ?? contact.phone,
        createdAt: user.createdAt,
      },
      contact: {
        id: contact.id,
        fullName: contact.fullName,
        position: contact.position,
        department: contact.department,
        email: contact.email,
        phone: contact.phone,
        mobile: contact.mobile,
        isPrimary: contact.isPrimary,
        status: contact.status,
      },
      client: {
        id: contact.client.id,
        clientCode: contact.client.clientCode,
        companyName: contact.client.companyName,
        industry: contact.client.industry,
        businessType: contact.client.businessType,
        website: contact.client.website,
        address: contact.client.address,
        status: contact.client.status,
      },
    };
  }
}
