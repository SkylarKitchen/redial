// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("../navigator/cssRuleGatherer", () => ({
  getMatchingRules: vi.fn(() => []),
}));

vi.mock("../core/apply", () => ({
  applyInlineStyle: vi.fn(),
  resetProp: vi.fn(),
  subscribeOverrides: vi.fn((cb: () => void) => () => {}),
  getOverrideSnapshot: vi.fn(() => 0),
}));

import { getMatchingRules } from "../navigator/cssRuleGatherer";
import { applyInlineStyle, resetProp } from "../core/apply";
import { CSSEditorView } from "../navigator/CSSEditorView";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMatchingRules).mockReturnValue([]);
});

afterEach(() => {
  cleanup();
});

describe("CSSEditorView", () => {
  it("renders empty state when selectedEl is null", () => {
    render(<CSSEditorView selectedEl={null} />);
    expect(
      screen.getByText("Select an element to see its CSS"),
    ).toBeTruthy();
  });

  it("renders rule blocks with correct selector text", () => {
    vi.mocked(getMatchingRules).mockReturnValue([
      {
        selector: ".card",
        declarations: [{ prop: "color", value: "red" }],
        source: "main.css",
        isState: false,
      },
    ]);
    const div = document.createElement("div");
    render(<CSSEditorView selectedEl={div} />);
    expect(screen.getByText(".card")).toBeTruthy();
    expect(screen.getByText("color")).toBeTruthy();
  });

  it("click value enters edit mode", () => {
    vi.mocked(getMatchingRules).mockReturnValue([
      {
        selector: ".card",
        declarations: [{ prop: "color", value: "red" }],
        source: "main.css",
        isState: false,
      },
    ]);
    const div = document.createElement("div");
    render(<CSSEditorView selectedEl={div} />);

    fireEvent.click(screen.getByTestId("value-0-0"));

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("red");
  });

  it("Enter commits edit and calls applyInlineStyle", () => {
    vi.mocked(getMatchingRules).mockReturnValue([
      {
        selector: ".card",
        declarations: [{ prop: "color", value: "red" }],
        source: "main.css",
        isState: false,
      },
    ]);
    const div = document.createElement("div");
    render(<CSSEditorView selectedEl={div} />);

    // Enter edit mode
    fireEvent.click(screen.getByTestId("value-0-0"));
    const input = screen.getByRole("textbox") as HTMLInputElement;

    // Change value and press Enter
    fireEvent.change(input, { target: { value: "blue" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(applyInlineStyle).toHaveBeenCalledWith(div, "color", "blue");
  });

  it("Escape cancels edit", () => {
    vi.mocked(getMatchingRules).mockReturnValue([
      {
        selector: ".card",
        declarations: [{ prop: "color", value: "red" }],
        source: "main.css",
        isState: false,
      },
    ]);
    const div = document.createElement("div");
    render(<CSSEditorView selectedEl={div} />);

    fireEvent.click(screen.getByTestId("value-0-0"));
    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();

    fireEvent.keyDown(input, { key: "Escape" });

    // Input should be gone, value text restored
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByTestId("value-0-0").textContent).toBe("red");
  });

  it("+ button only appears on inline block", () => {
    vi.mocked(getMatchingRules).mockReturnValue([
      {
        selector: ".card",
        declarations: [{ prop: "color", value: "red" }],
        source: "main.css",
        isState: false,
      },
      {
        selector: "element.style",
        declarations: [{ prop: "margin", value: "10px" }],
        source: "inline",
        isState: false,
      },
    ]);
    const div = document.createElement("div");
    render(<CSSEditorView selectedEl={div} />);

    const addButtons = screen.getAllByLabelText("Add declaration");
    expect(addButtons.length).toBe(1);
  });

  it("strikethrough on overridden declarations", () => {
    vi.mocked(getMatchingRules).mockReturnValue([
      {
        selector: ".base",
        declarations: [{ prop: "color", value: "red" }],
        source: "base.css",
        isState: false,
      },
      {
        selector: ".override",
        declarations: [{ prop: "color", value: "blue" }],
        source: "override.css",
        isState: false,
      },
    ]);
    const div = document.createElement("div");
    render(<CSSEditorView selectedEl={div} />);

    // The first block's "red" value should be struck through (overridden)
    const redEl = screen.getByTestId("value-0-0");
    expect(redEl.style.textDecoration).toContain("line-through");
    expect(redEl.style.opacity).toBe("0.5");

    // The second block's "blue" value should NOT be struck through (it wins)
    const blueEl = screen.getByTestId("value-1-0");
    expect(blueEl.style.textDecoration).not.toContain("line-through");
  });
});
