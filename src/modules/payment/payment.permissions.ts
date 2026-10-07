import { AccessScope } from "@prisma/client";

import { definePermissions } from "../rbac/dto/permission-registry.types";

const paymentScopes = [AccessScope.OWN, AccessScope.ALL];

export const permissions = definePermissions([
  {
    code: "payment.read",
    module: "payment",
    action: "read",
    description: "Melihat data payment",
    allowedScopes: paymentScopes,
  },
  {
    code: "payment.create",
    module: "payment",
    action: "create",
    description: "Membuat payment",
    allowedScopes: paymentScopes,
  },
  {
    code: "payment.update",
    module: "payment",
    action: "update",
    description: "Mengubah payment",
    allowedScopes: paymentScopes,
  },
  {
    code: "payment.verify",
    module: "payment",
    action: "verify",
    description: "Memverifikasi payment",
    allowedScopes: paymentScopes,
  },
  {
    code: "payment.reject",
    module: "payment",
    action: "reject",
    description: "Menolak payment",
    allowedScopes: paymentScopes,
  },
]);
