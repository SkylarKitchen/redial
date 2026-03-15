// @vitest-environment happy-dom
/**
 * labelScrub.test.ts — Verifies the LabelScrub drag-to-scrub interaction:
 *   - mousedown on a label starts scrub mode
 *   - mousemove changes value proportional to horizontal movement
 *   - Shift during scrub applies 10x multiplier
 *   - Alt during scrub applies 0.1x multiplier
 *   - mouseup commits the final value
 *   - cursor is ew-resize on scrubbable labels
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { LabelScrub } from "../controls/LabelScrub";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Setup ───────────────────────────────────────────────────────────

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  // happy-dom may not implement setPointerCapture/releasePointerCapture
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderLabelScrub(props: {
  value: number;
  onChange: ReturnType<typeof vi.fn>;
  onScrubStart?: ReturnType<typeof vi.fn>;
  onScrubEnd?: ReturnType<typeof vi.fn>;
  step?: number;
  deadZone?: number;
}) {
  act(() => {
    root.render(
      createElement(LabelScrub, {
        children: "Width",
        value: props.value,
        onChange: props.onChange,
        onScrubStart: props.onScrubStart,
        onScrubEnd: props.onScrubEnd,
        step: props.step ?? 1,
        deadZone: props.deadZone ?? 3,
      }),
    );
  });
}

function getLabel(): HTMLElement {
  const span = container.querySelector("span");
  if (!span) throw new Error("LabelScrub span not found");
  return span;
}

function pointerDown(el: HTMLElement, clientX: number, opts?: Partial<PointerEventInit>) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX,
        clientY: 50,
        pointerId: 1,
        ...opts,
      }),
    );
  });
}

function pointerMove(el: HTMLElement, clientX: number, opts?: Partial<PointerEventInit>) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX,
        clientY: 50,
        pointerId: 1,
        ...opts,
      }),
    );
  });
}

function pointerUp(el: HTMLElement, opts?: Partial<PointerEventInit>) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        ...opts,
      }),
    );
  });
}

// ─── Cursor style ────────────────────────────────────────────────────

describe("cursor style on scrubbable labels", () => {
  it("renders with ew-resize cursor", () => {
    const onChange = vi.fn();
    renderLabelScrub({ value: 100, onChange });
    const label = getLabel();
    expect(label.style.cursor).toBe("ew-resize");
  });

  it("source declares cursor: ew-resize in the style object", () => {
    const src = readFileSync(
      join(__dirname, "..", "controls", "LabelScrub.tsx"),
      "utf-8",
    );
    expect(src).toContain('cursor: "ew-resize"');
  });
});

// ─── Pointer down starts scrub intent ────────────────────────────────

describe("pointerdown on label", () => {
  it("does not immediately call onChange (dead zone)", () => {
    const onChange = vi.fn();
    renderLabelScrub({ value: 100, onChange });
    const label = getLabel();
    pointerDown(label, 100);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not call onScrubStart before exceeding dead zone", () => {
    const onScrubStart = vi.fn();
    const onChange = vi.fn();
    renderLabelScrub({ value: 100, onChange, onScrubStart });
    const label = getLabel();

    pointerDown(label, 100);
    // Move within dead zone (< 3px)
    pointerMove(label, 102);
    expect(onScrubStart).not.toHaveBeenCalled();
  });
});

// ─── Scrub start after exceeding dead zone ───────────────────────────

describe("scrub starts after exceeding dead zone", () => {
  it("calls onScrubStart when movement exceeds dead zone", () => {
    const onScrubStart = vi.fn();
    const onChange = vi.fn();
    renderLabelScrub({ value: 100, onChange, onScrubStart });
    const label = getLabel();

    pointerDown(label, 100);
    // Move beyond dead zone (>= 3px)
    pointerMove(label, 104);
    expect(onScrubStart).toHaveBeenCalledTimes(1);
  });

  it("calls onChange with value proportional to movement", () => {
    const onChange = vi.fn();
    renderLabelScrub({ value: 100, onChange, step: 1 });
    const label = getLabel();

    pointerDown(label, 100);
    // Move 10px right → delta = 10 * 1 * 1 = 10, value = 100 + 10 = 110
    pointerMove(label, 110);
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toBe(110);
  });
});

// ─── Value changes proportional to horizontal movement ───────────────

describe("mousemove changes value proportional to horizontal movement", () => {
  it("increases value when moving right", () => {
    const onChange = vi.fn();
    renderLabelScrub({ value: 50, onChange, step: 1 });
    const label = getLabel();

    pointerDown(label, 100);
    pointerMove(label, 120); // +20px → value = 50 + 20 = 70
    const lastValue = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastValue).toBe(70);
  });

  it("decreases value when moving left", () => {
    const onChange = vi.fn();
    renderLabelScrub({ value: 50, onChange, step: 1 });
    const label = getLabel();

    pointerDown(label, 100);
    pointerMove(label, 80); // -20px → value = 50 - 20 = 30
    const lastValue = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastValue).toBe(30);
  });

  it("respects custom step", () => {
    const onChange = vi.fn();
    renderLabelScrub({ value: 0, onChange, step: 0.5 });
    const label = getLabel();

    pointerDown(label, 100);
    pointerMove(label, 120); // +20px * 0.5 step = 10
    const lastValue = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastValue).toBe(10);
  });
});

// ─── Shift applies 10x multiplier ────────────────────────────────────

describe("Shift during scrub applies 10x multiplier", () => {
  it("multiplies delta by 10 when shift is held", () => {
    const onChange = vi.fn();
    renderLabelScrub({ value: 0, onChange, step: 1 });
    const label = getLabel();

    pointerDown(label, 100);
    // Move 10px right with shift → delta = 10 * 1 * 10 = 100
    pointerMove(label, 110, { shiftKey: true });
    const lastValue = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastValue).toBe(100);
  });

  it("source confirms shift multiplier is 10", () => {
    const src = readFileSync(
      join(__dirname, "..", "controls", "LabelScrub.tsx"),
      "utf-8",
    );
    expect(src).toContain("if (ev.shiftKey) multiplier = 10");
  });
});

// ─── Alt applies 0.1x multiplier ─────────────────────────────────────

describe("Alt during scrub applies 0.1x multiplier", () => {
  it("multiplies delta by 0.1 when alt is held", () => {
    const onChange = vi.fn();
    renderLabelScrub({ value: 0, onChange, step: 1 });
    const label = getLabel();

    pointerDown(label, 100);
    // Move 10px right with alt → delta = 10 * 1 * 0.1 = 1.0
    pointerMove(label, 110, { altKey: true });
    const lastValue = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastValue).toBe(1);
  });

  it("source confirms alt multiplier is 0.1", () => {
    const src = readFileSync(
      join(__dirname, "..", "controls", "LabelScrub.tsx"),
      "utf-8",
    );
    expect(src).toContain("if (ev.altKey) multiplier = 0.1");
  });
});

// ─── Pointerup commits the final value ───────────────────────────────

describe("mouseup commits the final value", () => {
  it("calls onScrubEnd on pointerup after a drag", () => {
    const onScrubEnd = vi.fn();
    const onChange = vi.fn();
    renderLabelScrub({ value: 100, onChange, onScrubEnd });
    const label = getLabel();

    pointerDown(label, 100);
    pointerMove(label, 120); // exceeds dead zone, starts scrub
    pointerUp(label);

    expect(onScrubEnd).toHaveBeenCalledTimes(1);
  });

  it("the last onChange value before pointerup is the committed value", () => {
    const onChange = vi.fn();
    renderLabelScrub({ value: 0, onChange, step: 1 });
    const label = getLabel();

    pointerDown(label, 100);
    pointerMove(label, 110); // +10
    pointerMove(label, 115); // +15
    pointerMove(label, 120); // +20

    const lastValue = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastValue).toBe(20);

    pointerUp(label);
    // No additional onChange call from pointerup itself
    const callCount = onChange.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it("does not call onScrubEnd if drag never exceeded dead zone (click)", () => {
    const onScrubEnd = vi.fn();
    const onChange = vi.fn();
    renderLabelScrub({ value: 100, onChange, onScrubEnd });
    const label = getLabel();

    pointerDown(label, 100);
    pointerMove(label, 101); // within dead zone
    pointerUp(label);

    expect(onScrubEnd).not.toHaveBeenCalled();
  });
});

// ─── Source-level verification ────────────────────────────────────────

describe("LabelScrub source structure", () => {
  const src = readFileSync(
    join(__dirname, "..", "controls", "LabelScrub.tsx"),
    "utf-8",
  );

  it("uses setPointerCapture for reliable drag tracking", () => {
    expect(src).toContain("setPointerCapture");
  });

  it("implements a dead zone before starting the scrub", () => {
    expect(src).toContain("deadZone");
    expect(src).toContain("Math.abs(dx)");
  });

  it("sets body cursor to ew-resize during active scrub", () => {
    expect(src).toContain('document.body.style.cursor = "ew-resize"');
  });

  it("restores body cursor on cleanup", () => {
    expect(src).toContain("document.body.style.cursor = prevCursor");
  });

  it("sets userSelect to none during scrub", () => {
    expect(src).toContain('document.body.style.userSelect = "none"');
  });

  it("integrates with scrubState (setScrubActive)", () => {
    expect(src).toContain("setScrubActive(true)");
    expect(src).toContain("setScrubActive(false)");
  });

  it("integrates with batch operations (beginBatch/endBatch)", () => {
    expect(src).toContain("beginBatch()");
    expect(src).toContain("endBatch()");
  });

  it("cleans up event listeners on pointer up", () => {
    expect(src).toContain("removeEventListener");
  });
});
