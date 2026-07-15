// @vitest-environment happy-dom
/**
 * modeOverrideFileSave.test.tsx — issue #53, second half: CSS-variable mode
 * overrides are FILE-SAVED.
 *
 * The Footer save pipeline used to keep mode overrides clipboard-only (they
 * never entered the commit POST at all). Post-#53(b), a mode override whose
 * variable definition resolves to a stylesheet is enriched with a
 * `modeSelector` field, included in the POST, and — on a fully successful
 * save — cleared from the pending mode-override store (the file is now the
 * source of truth). Unresolvable overrides keep the clipboard side-channel;
 * server-refused ones stay pending.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRef } from "react";
import { Footer } from "../shell/Footer";
import { ChangesDrawer } from "../shell/ChangesDrawer";
import { styleEngine } from "../core/engine";
import {
  applyModeOverride,
  resetAllModeOverrides,
  getModeOverrideCount,
} from "../core/modeOverrides";

const styles: HTMLStyleElement[] = [];

/** A stylesheet with an href, so getVariableDefinitionSource can resolve a
 *  var to a project file (happy-dom style sheets have no href by default). */
function addLinkedStyle(css: string, href: string): void {
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
  styles.push(el);
  Object.defineProperty(el.sheet as CSSStyleSheet, "href", {
    value: href,
    configurable: true,
  });
}

/** CSS-module-classed element (same fixture as breakpointFileSave):
 *  className "btn", sourceFile "Button.module.scss". */
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
let fetchMock: ReturnType<typeof vi.fn>;
let clipboardWrites: string[];

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
  document.head.querySelectorAll("style").forEach((s) => s.remove());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ written: ["tokens/semantic.css"], failed: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);

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
  for (const el of styles) el.remove();
  styles.length = 0;
  vi.unstubAllGlobals();
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

describe("mode overrides are file-saved (#53 second half)", () => {
  it("a resolvable mode override flows into the POST with modeSelector and clears on success", async () => {
    addLinkedStyle(
      ':root { --brand: blue; }\n[data-theme="dark"] { --brand: navy; }',
      "http://localhost/tokens/semantic.css",
    );
    const el = makeModuleEl();
    applyModeOverride('[data-theme="dark"]', "--brand", "red");

    await renderAndSave(el);

    // Mode-only save: no element changes, but the override is file-bound now.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0]).toMatchObject({
      prop: "--brand",
      from: "",
      to: "red",
      modeSelector: '[data-theme="dark"]',
      sourceFile: "tokens/semantic.css",
    });

    // Fully successful save clears the pending store — the file caught up.
    expect(getModeOverrideCount()).toBe(0);

    // No "(not saved to file)" clipboard side-channel for a file-bound override.
    const modeWrite = clipboardWrites.find((t) => t.includes("--brand"));
    expect(modeWrite, "file-bound mode override must not double-copy").toBeUndefined();
  });

  it("an UNRESOLVABLE mode override keeps the clipboard side-channel and stays pending", async () => {
    // No stylesheet defines --ghost anywhere: definition site unresolvable.
    const el = makeModuleEl();
    applyModeOverride(".dark", "--ghost", "red");

    await renderAndSave(el);

    // Nothing file-bound → no POST at all; the override goes to the clipboard.
    expect(fetchMock).not.toHaveBeenCalled();
    const modeWrite = clipboardWrites.find((t) => t.includes("--ghost: red"));
    expect(modeWrite, "unresolvable override must reach the clipboard").toBeTruthy();
    expect(modeWrite).toContain(".dark");
    // Still pending — nothing was written to a file.
    expect(getModeOverrideCount()).toBe(1);
  });

  it("a mixed base + mode save sends both in ONE POST", async () => {
    addLinkedStyle(
      ".dark { --accent: navy; }",
      "http://localhost/tokens/semantic.css",
    );
    const el = makeModuleEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    applyModeOverride(".dark", "--accent", "teal");

    await renderAndSave(el);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.changes).toHaveLength(2);
    const modeChange = body.changes.find((c: { prop: string }) => c.prop === "--accent");
    expect(modeChange).toMatchObject({
      to: "teal",
      modeSelector: ".dark",
      sourceFile: "tokens/semantic.css",
    });
    const baseChange = body.changes.find((c: { prop: string }) => c.prop === "color");
    expect(baseChange).toBeTruthy();
    expect(baseChange.modeSelector).toBeUndefined();
  });

  it("ChangesDrawer 'Save All' carries mode overrides in its POST and clears them on success", async () => {
    addLinkedStyle(
      ".dark { --accent: navy; }",
      "http://localhost/tokens/semantic.css",
    );
    const el = makeModuleEl();
    styleEngine.apply({ scope: "element", el }, "color", "red");
    applyModeOverride(".dark", "--accent", "teal");

    await act(async () => {
      root.render(
        <ChangesDrawer
          open
          onResetAll={() => {}}
          entries={[]}
          onUndoToIndex={() => {}}
          onClose={() => {}}
        />,
      );
    });
    const saveAll = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Save All",
    );
    expect(saveAll, "Save All button should render").toBeTruthy();
    await act(async () => {
      saveAll!.click();
      await flushMicrotasks();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const modeChange = body.changes.find((c: { prop: string }) => c.prop === "--accent");
    expect(modeChange, "Save All must not drop pending mode overrides").toMatchObject({
      to: "teal",
      modeSelector: ".dark",
      sourceFile: "tokens/semantic.css",
    });
    expect(getModeOverrideCount()).toBe(0);
  });

  it("a server-refused mode override stays pending (find-or-refuse round trip)", async () => {
    addLinkedStyle(
      ".dark { --accent: navy; }",
      "http://localhost/tokens/semantic.css",
    );
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        written: [],
        failed: [
          {
            prop: "--accent",
            modeSelector: ".dark",
            reason: 'mode block ".dark" not found in tokens/semantic.css — the override stays on the clipboard export',
          },
        ],
      }),
    });
    const el = makeModuleEl();
    applyModeOverride(".dark", "--accent", "teal");

    await renderAndSave(el);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Refused server-side → NOT cleared; the edit is still pending.
    expect(getModeOverrideCount()).toBe(1);
  });
});
