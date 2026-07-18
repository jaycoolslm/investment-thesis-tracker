import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import http from "node:http";
import type { AddressInfo } from "node:net";

// Mutable config mock — tests toggle DATA_PROVIDER_URL between cases.
const mockConfig = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  PORT: 3001,
  NODE_ENV: "test",
  DATA_PROVIDER_URL: undefined as string | undefined,
};

vi.mock("../../config.js", () => ({ config: mockConfig }));

const { createApp } = await import("../../app.js");
const app = createApp();

const providerHealthPayload = {
  status: "ok",
  articleCount: 145,
  bodyCount: 12,
  sources: [
    {
      source: "ft",
      lastRun: {
        id: 7,
        source: "ft",
        startedAt: "2026-07-18T06:00:01.000Z",
        finishedAt: "2026-07-18T06:03:22.000Z",
        articlesSeen: 140,
        articlesNew: 9,
        error: null,
      },
    },
  ],
};

describe("GET /api/provider/health", () => {
  beforeEach(() => {
    mockConfig.DATA_PROVIDER_URL = undefined;
  });

  it("returns 503 when DATA_PROVIDER_URL is unset", async () => {
    const res = await request(app).get("/api/provider/health");
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Data provider not configured");
  });

  describe("with a stub provider", () => {
    let server: http.Server;
    let baseUrl: string;

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        if (req.url === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(providerHealthPayload));
          return;
        }
        res.writeHead(404).end();
      });
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("relays the provider health JSON verbatim", async () => {
      mockConfig.DATA_PROVIDER_URL = baseUrl;
      const res = await request(app).get("/api/provider/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(providerHealthPayload);
    });
  });

  it("returns 503 'unreachable' when the provider refuses the connection", async () => {
    // Reserve a port then close it so nothing is listening.
    const throwaway = http.createServer();
    const port = await new Promise<number>((resolve) => {
      throwaway.listen(0, () => resolve((throwaway.address() as AddressInfo).port));
    });
    await new Promise<void>((resolve) => throwaway.close(() => resolve()));

    mockConfig.DATA_PROVIDER_URL = `http://127.0.0.1:${port}`;
    const res = await request(app).get("/api/provider/health");
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Data provider unreachable");
  });
});
