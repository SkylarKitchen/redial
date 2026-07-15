// @vitest-environment happy-dom
/**
 * breakpointFileSave.test.tsx — issue #53: breakpoint edits are FILE-SAVED.
 *
 * The Footer save pipeline used to drop breakpoint-tagged changes from the
 * commit POST entirely (clipboard side-channel only). Post-#53, a responsive
 * edit on an element with a resolvable class + stylesheet is enriched with a
 * `breakpoint: { id, minWidth }` field, included in the POST, and — on a fully
 * successful save — cleared from the unsaved-changes state (the file is now
 * the source of truth, like base edits after HMR catch-up).
 *
 * Classless / unresolvable elements keep the clipboard side-channel — that
 * contract is pinned separately in saveBreakpointSideChannel.test.tsx.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRef } from "react";
import { Footer } from "../shell/Footer";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";
import { __setTransportForTests, type SaveTransport } from "../core/save";

/** CSS-module-classed element: getModuleClassInfo → className "btn",
 *  deriveSourceFromClassName → sourceFile "Button.module.scss". */
function makeModuleEl(): HTMLElement {
  const el = document.createElement("div");
  el.className = "Button_btn__a1b2c";
  document.body.appendChild(el);
  return el;
}

async function flushMicrotasks() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

let container: HTMLDivElement;
let root: Root;
let transportMock: ReturnType<typeof vi.fn>;
let clipboardWrites: string[];

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  transportMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ written: ["Button.module.scss"], failed: [] }),
  });
  __setTransportForTests(transportMock as unknown as SaveTransport);

  clipboardWrites = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn((text: string) => {
        clipboardWrites.push(text);
        return Promise.resolve();
      }),
    },
  });
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  __setTransportForTests(null);
  styleEngine.resetAll();
  resetAllModeOverrides();
});

async function renderAndSave(el: HTMLElement): Promise<void> {
  const saveRef = createRef<(() => void) | null>() as React.MutableRefObject<(() => void) | null>;
  saveRef.current = null;
  await act(async () => {
    root.render(
      <Footer
        element={el}
        onReset={() => {}}
        saveRef={saveRef}
        scopeCtx={{ scope: "element", activeClassName: null, activeState: "none" }}
      />,
    );
  });
  expect(saveRef.current).toBeTypeOf("function");
  await act(async () => {
    saveRef.current!();
    await flushMicrotasks();
  });
}

describe("breakpoint edits are file-saved (#53)", () => {
  it("a breakpoint-tagged edit flows into the POST body with { id, minWidth } and clears on success", async () => {
    const el = makeModuleEl();
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "blue");
    expect(styleEngine.diffElement(el)).toHaveLength(1);

    await renderAndSave(el);

    // The responsive edit is FILE-BOUND now: one POST, carrying the change
    // with its resolved media condition.
    expect(transportMock).toHaveBeenCalledTimes(1);
    const body = transportMock.mock.calls[0][0];
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0]).toMatchObject({
      prop: "color",
      to: "blue",
      className: "btn",
      sourceFile: "Button.module.scss",
      breakpoint: { id: "768", minWidth: 768 },
    });

    // Saved → cleared from the unsaved-changes state (like base edits after
    // HMR catch-up; breakpoint keys are tracked-only, so save IS the moment
    // the source catches up).
    expect(styleEngine.diffElement(el)).toHaveLength(0);
    expect(styleEngine.overrideCount(el)).toBe(0);

    // No "@media … (not saved to file)" side-channel for a file-bound edit.
    const mediaWrite = clipboardWrites.find((t) => t.includes("@media"));
    expect(mediaWrite, "file-bound breakpoint edit must not double-copy as @media").toBeUndefined();
  });

  it("a mixed base + breakpoint save sends both; only the breakpoint override clears", async () => {
    const el = makeModuleEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el, breakpoint: "1024" }, "width", "100px");

    await renderAndSave(el);

    expect(transportMock).toHaveBeenCalledTimes(1);
    const body = transportMock.mock.calls[0][0];
    expect(body.changes).toHaveLength(2);

    const base = body.changes.find((c: { prop: string }) => c.prop === "color");
    expect(base).toBeTruthy();
    expect(base.breakpoint).toBeUndefined();

    const bp = body.changes.find((c: { prop: string }) => c.prop === "width");
    expect(bp).toBeTruthy();
    expect(bp.breakpoint).toEqual({ id: "1024", minWidth: 1024 });
    expect(bp.className).toBe("btn");

    // Base overrides stay tracked (they clear later via HMR redundancy
    // detection); the breakpoint override clears now.
    const remaining = styleEngine.diffElement(el);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].prop).toBe("color");
    expect(remaining[0].breakpoint).toBeUndefined();
  });

  it("keeps breakpoint overrides tracked when the save reports per-item failures", async () => {
    const el = makeModuleEl();
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "blue");

    transportMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        written: [],
        failed: [{ prop: "color", reason: "file not found" }],
      }),
    });

    await renderAndSave(el);

    // Not written → NOT cleared; the user can fix the cause and retry.
    expect(styleEngine.diffElement(el)).toHaveLength(1);
  });

  it("a state edit at a breakpoint carries both state and breakpoint in the payload", async () => {
    const el = makeModuleEl();
    styleEngine.apply({ scope: "state", el, state: "hover", breakpoint: "768" }, "color", "teal");

    await renderAndSave(el);

    expect(transportMock).toHaveBeenCalledTimes(1);
    const body = transportMock.mock.calls[0][0];
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0]).toMatchObject({
      prop: "color",
      to: "teal",
      state: "hover",
      className: "btn",
      breakpoint: { id: "768", minWidth: 768 },
    });
    // Fully saved → cleared.
    expect(styleEngine.diffElement(el)).toHaveLength(0);
  });
});
