import { getEnv, type Env } from "../config/env.js";
import { log } from "../utils/logger.js";
import { InMemoryStorage } from "./repositories/InMemoryStorage.js";
import type { Storage } from "./repositories/types.js";

/**
 * Choose the storage backend. If a DATABASE_URL is configured we use Prisma
 * (PostgreSQL); otherwise we fall back to the in-memory store so the pipeline
 * still runs — e.g. for Phase-1 mock-data runs. Prisma is loaded lazily so the
 * in-memory path has no dependency on a generated Prisma client.
 */
export async function createStorage(env: Env = getEnv()): Promise<Storage> {
  const logger = log("storage");
  if (!env.DATABASE_URL) {
    logger.info("no DATABASE_URL set — using in-memory storage (data not persisted)");
    return new InMemoryStorage();
  }
  try {
    const [{ PrismaClient }, { PrismaStorage }] = await Promise.all([
      import("@prisma/client"),
      import("./repositories/PrismaStorage.js"),
    ]);
    const client = new PrismaClient();
    await client.$connect();
    logger.info("connected to PostgreSQL via Prisma");
    return new PrismaStorage(client);
  } catch (error) {
    logger.error(
      { err: (error as Error).message },
      "failed to initialize Prisma storage — falling back to in-memory. " +
        "Run `npm run db:generate` and `npm run db:migrate`, and check DATABASE_URL.",
    );
    return new InMemoryStorage();
  }
}
