import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddHoldingModal } from "../AddHoldingModal.tsx";

function renderModal(props = {}) {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
  };
  return render(<AddHoldingModal {...defaultProps} {...props} />);
}

describe("AddHoldingModal", () => {
  it("renders all form fields when open", () => {
    renderModal();

    expect(screen.getByLabelText("Ticker")).toBeInTheDocument();
    expect(screen.getByLabelText("Company Name")).toBeInTheDocument();
    expect(screen.getByText("Long")).toBeInTheDocument();
    expect(screen.getByText("Short")).toBeInTheDocument();
    expect(screen.getByLabelText("Thesis Bullets")).toBeInTheDocument();
    expect(
      screen.getByText("Broker Research (optional)"),
    ).toBeInTheDocument();
  });

  it("has Generate Thesis button disabled when fields are empty", () => {
    renderModal();
    const button = screen.getByRole("button", { name: /generate thesis/i });
    expect(button).toBeDisabled();
  });

  it("enables Generate Thesis when required fields are filled", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Ticker"), "AAPL");
    await user.type(screen.getByLabelText("Company Name"), "Apple Inc.");
    await user.type(
      screen.getByLabelText("Thesis Bullets"),
      "Strong growth",
    );

    const button = screen.getByRole("button", { name: /generate thesis/i });
    expect(button).toBeEnabled();
  });

  it("calls onSubmit with correct data shape", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderModal({ onSubmit });

    await user.type(screen.getByLabelText("Ticker"), "AAPL");
    await user.type(screen.getByLabelText("Company Name"), "Apple Inc.");
    await user.type(
      screen.getByLabelText("Thesis Bullets"),
      "Strong growth",
    );

    await user.click(
      screen.getByRole("button", { name: /generate thesis/i }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: "AAPL",
        companyName: "Apple Inc.",
        direction: "long",
        benchmark: "S&P 500",
        bullets: "Strong growth",
        files: [],
      }),
    );
  });

  it("defaults to Long position", () => {
    renderModal();
    const longButton = screen.getByText("Long");
    expect(longButton).toHaveAttribute("data-state", "on");
  });

  it("shows Generating... when isSubmitting", () => {
    renderModal({ isSubmitting: true });
    expect(screen.getByText("Generating...")).toBeInTheDocument();
  });

  it("disables button when isSubmitting", () => {
    renderModal({ isSubmitting: true });
    const button = screen.getByRole("button", { name: /generating/i });
    expect(button).toBeDisabled();
  });

  it("does not render when closed", () => {
    render(
      <AddHoldingModal
        open={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByText("Add Holding")).not.toBeInTheDocument();
  });
});
