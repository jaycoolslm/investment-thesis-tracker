import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config before importing EmailService
const mockConfig = {
  SMTP_HOST: undefined as string | undefined,
  SMTP_PORT: undefined as number | undefined,
  SMTP_USER: undefined as string | undefined,
  SMTP_PASS: undefined as string | undefined,
  EMAIL_FROM: undefined as string | undefined,
  EMAIL_TO: undefined as string | undefined,
  APP_URL: "http://localhost:5173",
};

vi.mock("../../config.js", () => ({
  config: mockConfig,
}));

// Mock DB
vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

const { EmailService } = await import("../email.js");

describe("EmailService", () => {
  describe("without SMTP configured", () => {
    it("skips sending and logs a warning", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const service = new EmailService();
      await service.sendWeeklyDigest("2026-W16");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("SMTP not configured"),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("with injected transport", () => {
    let mockTransport: { sendMail: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockTransport = {
        sendMail: vi.fn().mockResolvedValue({ messageId: "test-123" }),
      };
      mockConfig.EMAIL_TO = "test@example.com";
    });

    it("skips when no weekly logs found", async () => {
      const service = new EmailService(mockTransport as never);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await service.sendWeeklyDigest("2026-W16");

      expect(mockTransport.sendMail).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No weekly logs"),
      );
      consoleSpy.mockRestore();
    });
  });
});
