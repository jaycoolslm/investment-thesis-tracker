import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export default async function setup() {
  const pgContainer = await new PostgreSqlContainer("postgres:16-alpine").start();
  const redisContainer = await new RedisContainer("redis:7-alpine").start();

  // Set env vars for the test process — config.ts reads these
  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL = redisContainer.getConnectionUrl();
  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "test-key";

  // Run the migration SQL directly (no drizzle-kit dependency in tests)
  const migrationSql = readFileSync(
    resolve(import.meta.dirname, "../db/migrations/0000_eminent_juggernaut.sql"),
    "utf-8",
  );

  const client = new pg.Client({ connectionString: pgContainer.getConnectionUri() });
  await client.connect();
  // Split on Drizzle's statement breakpoint marker
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await client.query(stmt);
  }
  await client.end();

  return async function teardown() {
    await pgContainer.stop();
    await redisContainer.stop();
  };
}
