import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { injectable, singleton } from "tsyringe";

@singleton()
@injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not defined");
    }

    const adapter = new PrismaPg({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });

    super({
      adapter,
      log:
        process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });

    this.setupShutdownHandler();
  }

  private setupShutdownHandler(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Disconnecting Prisma...`);
      await this.$disconnect();
      process.exit(0);
    };

    process.once("SIGINT", () => {
      void gracefulShutdown("SIGINT");
    });

    process.once("SIGTERM", () => {
      void gracefulShutdown("SIGTERM");
    });
  }
}
