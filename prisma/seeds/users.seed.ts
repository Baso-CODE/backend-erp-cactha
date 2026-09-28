import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

export async function seedUsers(prisma: PrismaClient) {
  const ownerRole = await prisma.role.findUnique({
    where: {
      code: "OWNER",
    },
  });

  if (!ownerRole) {
    throw new Error(
      'Role "OWNER" belum tersedia. Jalankan roles seed terlebih dahulu.',
    );
  }

  const name = process.env.SEED_OWNER_NAME;
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "SEED_OWNER_NAME, SEED_OWNER_EMAIL, dan SEED_OWNER_PASSWORD wajib dikonfigurasi.",
    );
  }

  const passwordHash = await argon2.hash(password);

  const owner = await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      name,
      password: passwordHash,
      isActive: true,
    },
    create: {
      name,
      email,
      password: passwordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: owner.id,
        roleId: ownerRole.id,
      },
    },
    update: {},
    create: {
      userId: owner.id,
      roleId: ownerRole.id,
    },
  });

  console.log(`OWNER seeded: ${owner.email}`);
}
