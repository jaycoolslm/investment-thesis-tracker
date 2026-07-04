import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourcesList } from "../thesis/SourcesList.tsx";
import type { Source } from "../../api/client.ts";

describe("SourcesList", () => {
  it("renders sources as title + link", () => {
    render(
      <SourcesList
        sources={[
          { title: "Q1 earnings release", url: "https://example.com" },
          { title: "Analyst note", url: null },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: "Q1 earnings release" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(screen.getByText("Analyst note")).toBeInTheDocument();
  });

  it("tolerates legacy stored sources that still carry a type field", () => {
    const legacySources = [
      { title: "Q2 10-Q", url: "https://sec.gov", type: "filing" },
      { title: "Broker note", url: null, type: "broker_research" },
    ] as unknown as Source[];

    render(<SourcesList sources={legacySources} />);

    expect(
      screen.getByRole("link", { name: "Q2 10-Q" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Broker note")).toBeInTheDocument();
    // The legacy type is ignored — no badge text rendered
    expect(screen.queryByText("Filing")).not.toBeInTheDocument();
    expect(screen.queryByText("Research")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no sources", () => {
    render(<SourcesList sources={[]} />);
    expect(
      screen.getByText(/No sources recorded for this thesis/i),
    ).toBeInTheDocument();
  });
});
