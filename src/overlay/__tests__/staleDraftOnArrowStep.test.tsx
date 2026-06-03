// @vitest-environment happy-dom
/**
 * staleDraftOnArrowStep.test.tsx — regression for the stale-draft bug.
 *
 * Bug: FilterSliders `NumberInput` and TransitionEditor `MsInput` step the
 * committed value on ArrowUp/ArrowDown (via onStep → onChange) but DO NOT
 * write the stepped value back into the local draft. Because both inputs
 * display `focused ? draft : String(value)` and resync is gated on `!focused`,
 * a focused input keeps showing the OLD number after an arrow-step until blur.
 *
 * These tests use a STATEFUL parent so onChange actually updates the `value`
 * prop (the real-app condition). They assert the *displayed* value, i.e. the
 * user-visible symptom — failing on current code, passing once the inputs
 * pass `stepUpdatesDraft: true` to useDraftNumber.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { FilterEditor, createDefaultItem, type FilterItem } from "../sections/FilterSliders";
import { TransitionEditor, type TransitionValue } from "../sections/TransitionEditor";

beforeAll(() => {
  // happy-dom lacks pointer capture; useDragReorder calls it in drag handlers.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => cleanup());

/** The text input (not the range slider). */
function firstTextInput(): HTMLInputElement {
  const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
  return inputs.filter((i) => i.type !== "range")[0];
}

describe("FilterSliders NumberInput — focused draft tracks arrow-step (regression)", () => {
  function StatefulFilter() {
    const [items, setItems] = useState<FilterItem[]>([createDefaultItem("brightness")]); // value 100
    return <FilterEditor items={items} onChange={setItems} type="filter" />;
  }

  it("ArrowUp updates the displayed value while focused (not stale)", () => {
    render(<StatefulFilter />);
    const inp = firstTextInput();
    fireEvent.focus(inp);
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(inp.value).toBe("101");
  });

  it("ArrowDown updates the displayed value while focused (not stale)", () => {
    render(<StatefulFilter />);
    const inp = firstTextInput();
    fireEvent.focus(inp);
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(inp.value).toBe("99");
  });
});

describe("TransitionEditor MsInput — focused draft tracks arrow-step (regression)", () => {
  const BASE: TransitionValue = {
    property: "opacity",
    duration: 300,
    easing: "ease",
    delay: 0,
    visible: true,
  };

  function StatefulTransition() {
    const [transitions, setTransitions] = useState<TransitionValue[]>([{ ...BASE }]);
    const element = document.createElement("div");
    return <TransitionEditor transitions={transitions} onChange={setTransitions} element={element} />;
  }

  it("ArrowUp updates the displayed duration while focused (not stale)", () => {
    render(<StatefulTransition />);
    const inp = firstTextInput(); // duration is the first text input
    fireEvent.focus(inp);
    fireEvent.keyDown(inp, { key: "ArrowUp" });
    expect(inp.value).toBe("350");
  });

  it("ArrowDown updates the displayed duration while focused (not stale)", () => {
    render(<StatefulTransition />);
    const inp = firstTextInput();
    fireEvent.focus(inp);
    fireEvent.keyDown(inp, { key: "ArrowDown" });
    expect(inp.value).toBe("250");
  });
});
