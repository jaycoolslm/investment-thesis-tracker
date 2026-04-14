import "dotenv/config";
import * as z from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OPENAI_API_KEY: z.string().optional().transform((v) => v || undefined),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional().or(z.literal("")),
  AZURE_OPENAI_API_KEY: z.string().optional().transform((v) => v || undefined),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.issues);
  process.exit(1);
}

export const config = parsed.data;
