// @vitest-environment happy-dom
/**
 * saveBreakpointSideChannel.test.tsx — Bug A of the breakpoint-export
 * consolidation: **Cmd+S silently discards responsive edits.**
 *
 * The Footer's Save button routes breakpoint-tagged changes to the clipboard
 * as @media CSS (the #53 side-channel), but Overlay.tsx's Cmd+S handler ran a
 * SECOND, divergent save pipeline (its own enrichChangesForCommit + fetch)
 * with no side-channel — so a responsive edit saved via Cmd+S was silently
 * lost. The fix is structural: ONE save pipeline (Footer's), two triggers —
 * the Footer registers its save on a `saveRef` that Cmd+S invokes.
 *
 * RED before the fix:
 *  - Footer has no `saveRef` prop, so the keyboard path has no route into the
 *    breakpoint-preserving pipeline (test 1 fails on registration).
 *  - Overlay.tsx still owns a private enrich+fetch pipeline (test 3 fails).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRef } from "react";
import { Footer } from "../shell/Footer";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";
import { __setTransportForTests, type SaveTransport } from "../core/save";

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = "save-target";
  document.body.appendChild(el);
  return el;
}

async function flushMicrotasks() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
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
    json: async () => ({ written: ["app/page.tsx"], failed: [] }),
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

describe("one save pipeline, two triggers (Cmd+S must not lose breakpoint edits)", () => {
  it("Footer registers its save on saveRef; invoking it copies breakpoint edits as @media CSS", async () => {
    const el = makeEl();
    // A base edit (file-bound) and a responsive edit (clipboard-bound, #53).
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "color", "blue");

    const saveRef = createRef<(() => void) | null>() as React.MutableRefObject<(() => void) | null>;
    saveRef.current = null;

    await act(async () => {
      root.render(
        <Footer
          element={el}
          onReset={() => {}}
          saveRef={saveRef}
          scopeCtx={{ scope: "element", activeClassName: null, activeState: "none", activeBreakpoint: "768" }}
        />,
      );
    });

    // THE BUG: pre-fix there is no registration — Cmd+S has no route into the
    // breakpoint-preserving save pipeline.
    expect(saveRef.current, "Footer must register its save pipeline for Cmd+S").toBeTypeOf("function");

    await act(async () => {
      saveRef.current!();
      await flushMicrotasks();
    });

    // The responsive edit reached the clipboard as a real @media block...
    const mediaWrite = clipboardWrites.find((t) => t.includes("@media (min-width: 768px)"));
    expect(mediaWrite, "breakpoint edit must be exported as @media CSS, not dropped").toBeTruthy();
    expect(mediaWrite).toContain("color: blue");

    // ...and the file-bound POST carried ONLY the base change (no flattening).
    expect(transportMock).toHaveBeenCalledTimes(1);
    const body = transportMock.mock.calls[0][0];
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0]).toMatchObject({ prop: "color", to: "red" });
  });

  it("the save toast counts only file-bound properties (breakpoint edits went to the clipboard)", async () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "width", "100px");

    // Gate the clipboard write so the "Saved N" toast is observable before the
    // side-channel toast replaces it.
    let releaseClipboard!: () => void;
    const gate = new Promise<void>((resolve) => { releaseClipboard = resolve; });
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockImplementation(
      (text: string) => {
        clipboardWrites.push(text);
        return gate;
      },
    );

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

    // 2 changes exist, but only 1 went to the file — the toast must say 1.
    expect(container.textContent).toContain("Saved 1 property");
    expect(container.textContent).not.toContain("Saved 2");

    await act(async () => {
      releaseClipboard();
      await flushMicrotasks();
    });
  });

  it("with ONLY breakpoint edits, save skips the empty POST and still exports the @media CSS", async () => {
    const el = makeEl();
    styleEngine.apply({ scope: "element", el, breakpoint: "1024" }, "gap", "16px");

    const saveRef = createRef<(() => void) | null>() as React.MutableRefObject<(() => void) | null>;
    saveRef.current = null;

    await act(async () => {
      root.render(
        <Footer
          element={el}
          onReset={() => {}}
          saveRef={saveRef}
          scopeCtx={{ scope: "element", activeClassName: null, activeState: "none", activeBreakpoint: "1024" }}
        />,
      );
    });
    expect(saveRef.current).toBeTypeOf("function");

    await act(async () => {
      saveRef.current!();
      await flushMicrotasks();
    });

    const mediaWrite = clipboardWrites.find((t) => t.includes("@media (min-width: 1024px)"));
    expect(mediaWrite, "responsive-only save must still export @media CSS").toBeTruthy();
    expect(mediaWrite).toContain("gap: 16px");
    // Nothing was file-bound — no pointless POST with an empty changes array.
    expect(transportMock).not.toHaveBeenCalled();
  });

  it("ChangesDrawer Save All exports breakpoint edits as @media CSS instead of dropping them", async () => {
    const { ChangesDrawer } = await import("../shell/ChangesDrawer");
    const el = makeEl();
    styleEngine.apply({ scope: "element", el }, "color", "red"); // file-bound
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "width", "100px"); // clipboard-bound

    await act(async () => {
      root.render(
        <ChangesDrawer
          open={true}
          tab="pending"
          onResetAll={() => {}}
          entries={[]}
          onUndoToIndex={() => {}}
          onClose={() => {}}
        />,
      );
    });

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Save All",
    );
    expect(saveBtn).toBeTruthy();

    await act(async () => {
      saveBtn!.click();
      await flushMicrotasks();
    });

    // Same contract as the Footer pipeline: the POST carries only the
    // file-bound change, and the responsive edit reaches the clipboard.
    expect(transportMock).toHaveBeenCalledTimes(1);
    const body = transportMock.mock.calls[0][0];
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0]).toMatchObject({ prop: "color", to: "red" });

    const mediaWrite = clipboardWrites.find((t) => t.includes("@media (min-width: 768px)"));
    expect(mediaWrite, "Save All must not silently drop breakpoint edits").toBeTruthy();
    expect(mediaWrite).toContain("width: 100px");
  });

  it("Overlay.tsx no longer owns a second save pipeline (Cmd+S delegates to the Footer's)", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "..", "shell", "Overlay.tsx"), "utf-8");

    // THE BUG: the Cmd+S handler ran its own enrich + fetch, dropping
    // breakpoint changes with no clipboard side-channel. Post-consolidation the
    // commit pipeline lives ONLY in Footer.tsx.
    expect(src, "Overlay must not enrich changes itself").not.toContain("enrichChangesForCommit");
    expect(src, "Overlay must not POST to the commit endpoint itself").not.toContain("commitEndpoint");
  });
});
