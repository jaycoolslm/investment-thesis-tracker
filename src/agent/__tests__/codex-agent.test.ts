import { describe, it, expect, vi, beforeEach } from "vitest";
import { VALID_THESIS_FIXTURE, VALID_GENERATION_INPUT, GENERATION_INPUT_WITH_FILES } from "./fixtures.js";

const mockRun = vi.fn();
const mockStartThread = vi.fn(() => ({ run: mockRun }));

vi.mock("@openai/codex-sdk", () => ({
  Codex: class MockCodex {
    startThread = mockStartThread;
  },
}));

// Mock config to avoid needing real env vars
vi.mock("../../config.js", () => ({
  config: {
    OPENAI_API_KEY: "test-key",
    AZURE_OPENAI_ENDPOINT: undefined,
    AZURE_OPENAI_API_KEY: undefined,
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    REDIS_URL: "redis://localhost:6380",
    PORT: 3001,
    NODE_ENV: "test",
  },
}));

// Import after mocks are set up
const { ThesisAgent } = await import("../codex-agent.js");

describe("ThesisAgent", () => {
  let agent: InstanceType<typeof ThesisAgent>;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ThesisAgent();
  });

  it("calls startThread with correct options", async () => {
    mockRun.mockResolvedValueOnce({
      finalResponse: JSON.stringify(VALID_THESIS_FIXTURE),
      items: [],
    });

    await agent.generateThesis(VALID_GENERATION_INPUT);

    expect(mockStartThread).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        sandboxMode: "read-only",
        skipGitRepoCheck: true,
      }),
    );
  });

  it("passes additional directories when research files provided", async () => {
    mockRun.mockResolvedValueOnce({
      finalResponse: JSON.stringify(VALID_THESIS_FIXTURE),
      items: [],
    });

    await agent.generateThesis(GENERATION_INPUT_WITH_FILES);

    expect(mockStartThread).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalDirectories: ["/data/documents"],
      }),
    );
  });

  it("does not pass additional directories when no files", async () => {
    mockRun.mockResolvedValueOnce({
      finalResponse: JSON.stringify(VALID_THESIS_FIXTURE),
      items: [],
    });

    await agent.generateThesis(VALID_GENERATION_INPUT);

    expect(mockStartThread).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalDirectories: [],
      }),
    );
  });

  it("calls thread.run with prompt and outputSchema", async () => {
    mockRun.mockResolvedValueOnce({
      finalResponse: JSON.stringify(VALID_THESIS_FIXTURE),
      items: [],
    });

    await agent.generateThesis(VALID_GENERATION_INPUT);

    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining("AAPL"),
      expect.objectContaining({
        outputSchema: expect.any(Object),
      }),
    );
  });

  it("passes AbortSignal to thread.run", async () => {
    mockRun.mockResolvedValueOnce({
      finalResponse: JSON.stringify(VALID_THESIS_FIXTURE),
      items: [],
    });

    const controller = new AbortController();
    await agent.generateThesis(VALID_GENERATION_INPUT, controller.signal);

    expect(mockRun).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it("parses and validates turn.finalResponse", async () => {
    mockRun.mockResolvedValueOnce({
      finalResponse: JSON.stringify(VALID_THESIS_FIXTURE),
      items: [],
    });

    const result = await agent.generateThesis(VALID_GENERATION_INPUT);

    expect(result.summary).toBe(VALID_THESIS_FIXTURE.summary);
    expect(result.pillars).toHaveLength(3);
    expect(result.risks).toHaveLength(3);
  });

  it("throws on invalid JSON from agent", async () => {
    mockRun.mockResolvedValueOnce({
      finalResponse: "not valid json at all",
      items: [],
    });

    await expect(
      agent.generateThesis(VALID_GENERATION_INPUT),
    ).rejects.toThrow();
  });

  it("throws ZodError when response fails schema validation", async () => {
    mockRun.mockResolvedValueOnce({
      finalResponse: JSON.stringify({
        summary: "Short",
        pillars: [],
        qualityAssessment: "",
        valuation: {},
        assumptions: [],
        risks: [],
        sources: [],
      }),
      items: [],
    });

    await expect(
      agent.generateThesis(VALID_GENERATION_INPUT),
    ).rejects.toThrow();
  });

  it("propagates SDK errors", async () => {
    mockRun.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    await expect(
      agent.generateThesis(VALID_GENERATION_INPUT),
    ).rejects.toThrow("API rate limit exceeded");
  });
});
