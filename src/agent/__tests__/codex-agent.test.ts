import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  VALID_THESIS_FIXTURE,
  VALID_GENERATION_INPUT,
  GENERATION_INPUT_WITH_FILES,
  VALID_WEEKLY_LOG_FIXTURE,
  VALID_WEEKLY_ANALYSIS_INPUT,
} from "./fixtures.js";

// Helper: create a mock runStreamed that yields events and ends with the agent message
function mockRunStreamedResult(finalResponse: string) {
  async function* generate() {
    yield { type: "turn.started" as const };
    yield {
      type: "item.completed" as const,
      item: { id: "msg-1", type: "agent_message" as const, text: finalResponse },
    };
    yield { type: "turn.completed" as const, usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 50 } };
  }
  return { events: generate() };
}

function mockRunStreamedError(errorMessage: string) {
  async function* generate() {
    yield { type: "turn.started" as const };
    yield { type: "turn.failed" as const, error: { message: errorMessage } };
  }
  return { events: generate() };
}

const mockRunStreamed = vi.fn();
const mockStartThread = vi.fn(() => ({ runStreamed: mockRunStreamed }));

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
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_THESIS_FIXTURE)),
    );

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
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_THESIS_FIXTURE)),
    );

    await agent.generateThesis(GENERATION_INPUT_WITH_FILES);

    expect(mockStartThread).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalDirectories: ["/data/documents"],
      }),
    );
  });

  it("does not pass additional directories when no files", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_THESIS_FIXTURE)),
    );

    await agent.generateThesis(VALID_GENERATION_INPUT);

    expect(mockStartThread).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalDirectories: [],
      }),
    );
  });

  it("calls runStreamed with prompt and outputSchema", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_THESIS_FIXTURE)),
    );

    await agent.generateThesis(VALID_GENERATION_INPUT);

    expect(mockRunStreamed).toHaveBeenCalledWith(
      expect.stringContaining("AAPL"),
      expect.objectContaining({
        outputSchema: expect.any(Object),
      }),
    );
  });

  it("passes AbortSignal to runStreamed", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_THESIS_FIXTURE)),
    );

    const controller = new AbortController();
    await agent.generateThesis(VALID_GENERATION_INPUT, controller.signal);

    expect(mockRunStreamed).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it("parses and validates streamed response", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_THESIS_FIXTURE)),
    );

    const result = await agent.generateThesis(VALID_GENERATION_INPUT);

    expect(result.summary).toBe(VALID_THESIS_FIXTURE.summary);
    expect(result.pillars).toHaveLength(3);
    expect(result.risks).toHaveLength(3);
  });

  it("forwards events to onEvent callback", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_THESIS_FIXTURE)),
    );

    const onEvent = vi.fn();
    await agent.generateThesis(VALID_GENERATION_INPUT, undefined, onEvent);

    // Should have received turn.started, item.completed (agent_message), turn.completed
    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "item.completed" }),
    );
  });

  it("throws on invalid JSON from agent", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult("not valid json at all"),
    );

    await expect(
      agent.generateThesis(VALID_GENERATION_INPUT),
    ).rejects.toThrow();
  });

  it("throws ZodError when response fails schema validation", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(
        JSON.stringify({
          summary: "Short",
          pillars: [],
          qualityAssessment: "",
          valuation: {},
          assumptions: [],
          risks: [],
          sources: [],
        }),
      ),
    );

    await expect(
      agent.generateThesis(VALID_GENERATION_INPUT),
    ).rejects.toThrow();
  });

  it("throws on turn.failed event", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedError("API rate limit exceeded"),
    );

    await expect(
      agent.generateThesis(VALID_GENERATION_INPUT),
    ).rejects.toThrow("API rate limit exceeded");
  });
});

describe("ThesisAgent.analyseWeekly", () => {
  let agent: InstanceType<typeof ThesisAgent>;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ThesisAgent();
  });

  it("calls startThread with correct options", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_WEEKLY_LOG_FIXTURE)),
    );

    await agent.analyseWeekly(VALID_WEEKLY_ANALYSIS_INPUT);

    expect(mockStartThread).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "never",
        sandboxMode: "read-only",
        webSearchMode: "live",
        skipGitRepoCheck: true,
      }),
    );
  });

  it("passes additional directories when research files provided", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_WEEKLY_LOG_FIXTURE)),
    );

    await agent.analyseWeekly({
      ...VALID_WEEKLY_ANALYSIS_INPUT,
      researchFilePaths: ["/data/documents/abc-123/report.pdf"],
    });

    expect(mockStartThread).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalDirectories: ["/data/documents"],
      }),
    );
  });

  it("does not pass additional directories when no files", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_WEEKLY_LOG_FIXTURE)),
    );

    await agent.analyseWeekly(VALID_WEEKLY_ANALYSIS_INPUT);

    expect(mockStartThread).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalDirectories: [],
      }),
    );
  });

  it("calls runStreamed with prompt containing pillar titles", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_WEEKLY_LOG_FIXTURE)),
    );

    await agent.analyseWeekly(VALID_WEEKLY_ANALYSIS_INPUT);

    expect(mockRunStreamed).toHaveBeenCalledWith(
      expect.stringContaining("Services Revenue Flywheel"),
      expect.objectContaining({
        outputSchema: expect.any(Object),
      }),
    );
  });

  it("parses response through weeklyLogOutputSchema", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_WEEKLY_LOG_FIXTURE)),
    );

    const result = await agent.analyseWeekly(VALID_WEEKLY_ANALYSIS_INPUT);

    expect(result.thesisImpact).toBe("strengthened");
    expect(result.weekLabel).toBe("2026-W21");
    expect(result.pillarRefs).toHaveLength(2);
  });

  it("forwards events to onEvent callback", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(JSON.stringify(VALID_WEEKLY_LOG_FIXTURE)),
    );

    const onEvent = vi.fn();
    await agent.analyseWeekly(VALID_WEEKLY_ANALYSIS_INPUT, undefined, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(3);
  });

  it("throws on turn.failed event", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedError("Rate limit exceeded"),
    );

    await expect(
      agent.analyseWeekly(VALID_WEEKLY_ANALYSIS_INPUT),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("throws on invalid JSON from agent", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult("not json"),
    );

    await expect(
      agent.analyseWeekly(VALID_WEEKLY_ANALYSIS_INPUT),
    ).rejects.toThrow();
  });

  it("throws when response fails schema validation", async () => {
    mockRunStreamed.mockImplementationOnce(() =>
      mockRunStreamedResult(
        JSON.stringify({
          weekLabel: "",
          weekDate: "invalid",
          thesisImpact: "bad",
          summary: "",
          pillarRefs: [],
          sources: [],
        }),
      ),
    );

    await expect(
      agent.analyseWeekly(VALID_WEEKLY_ANALYSIS_INPUT),
    ).rejects.toThrow();
  });
});
