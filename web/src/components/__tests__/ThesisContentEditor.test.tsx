import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThesisContentEditor } from "../thesis/ThesisContentEditor.tsx";

const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("../../hooks/useThesisMutations.ts", () => ({
  useUpdateThesis: () => ({ mutateAsync: mockMutateAsync }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const CONTENT = `## Summary

Apple is a durable compounder.

## Risks

- **High:** Regulatory pressure.`;

describe("ThesisContentEditor", () => {
  it("renders markdown as formatted headings, never raw ##", () => {
    render(<ThesisContentEditor thesisId="t-1" initialValue={CONTENT} />);

    expect(
      screen.getByRole("heading", { name: "Summary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Apple is a durable compounder."),
    ).toBeInTheDocument();
    // No raw markdown markers shown to the user
    expect(screen.queryByText(/##/)).not.toBeInTheDocument();
    // Not in edit mode initially — no textarea
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("toggles to a textarea showing the raw markdown and autosaves on typing", async () => {
    const user = userEvent.setup();
    render(<ThesisContentEditor thesisId="t-1" initialValue={CONTENT} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));

    const textarea = screen.getByRole("textbox", { name: /thesis markdown/i });
    expect(textarea).toHaveValue(CONTENT);

    await user.type(textarea, " More.");

    // Debounced autosave should fire with the updated content
    await vi.waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    const calls = mockMutateAsync.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.thesisId).toBe("t-1");
    expect(lastCall.data.content).toContain("More.");
  });

  it("shows an empty-state prompt when there is no content", () => {
    render(<ThesisContentEditor thesisId="t-1" initialValue="" />);
    expect(screen.getByText(/no thesis content yet/i)).toBeInTheDocument();
  });
});
