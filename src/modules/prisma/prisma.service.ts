import { PrismaMariaDb } from "@prisma/adapter-mariadb";
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

    const url = new URL(databaseUrl);

    const adapter = new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      connectionLimit: 10,
      acquireTimeout: 10000,
      connectTimeout: 5000,
      idleTimeout: 300,
    });

    super({
      adapter,
      log: ["query", "info", "warn", "error"],
    });

    this.setupShutdownHandler();
  }

  private setupShutdownHandler(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Disconnecting Prisma...`);
      await this.$disconnect();
      process.exit(0);
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  }
}
