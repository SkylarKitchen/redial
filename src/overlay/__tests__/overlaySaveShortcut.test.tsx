// @vitest-environment happy-dom
/**
 * overlaySaveShortcut.test.tsx — review round 2, Issues 3 + 5:
 * **Cmd+S must never be a silent no-op, and the keydown→saveRef wiring must be
 * pinned end-to-end (not just by source-text tests).**
 *
 * Reachable regression: select an element → edit → open the Variables panel
 * from the Toolbar (sets `activePanel: variables` WITHOUT clearing
 * `selectedEl`) → Footer unmounts and its cleanup nulls `saveRef.current` →
 * Cmd+S passes the hotkey guard, `preventDefault()` suppresses the browser
 * save dialog, and then NOTHING happens — no save, no toast, no announcement.
 * The pre-consolidation baseline saved in this state.
 *
 * Fix (minimum viable): when `saveRef.current` is null, announce "Open the
 * style panel to save" via the aria live region (which must therefore be
 * mounted outside the inspector-only branch).
 *
 * These are MOUNTED tests of the real <Overlay/>: real keydown events drive
 * the real hotkey handler into the real Footer pipeline. Heavy panel children
 * that aren't under test are mocked out.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Overlay } from "../shell/Overlay";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";

// Not under test — keep the mounted tree light and deterministic.
vi.mock("../shell/WebflowPanel", () => ({ WebflowPanel: () => null }));
vi.mock("../shell/PromptPanel", () => ({ PromptPanel: () => null }));
vi.mock("../variables/GlobalVariablesPanel", () => ({ GlobalVariablesPanel: () => null }));
vi.mock("../navigator/NavigatorPanel", () => ({ NavigatorPanel: () => null }));

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = "page-target";
  document.body.appendChild(el);
  return el;
}

async function flushMicrotasks() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

function pressCmdS() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true, cancelable: true }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
let clipboardWrites: string[];
let unmountOverlay: (() => void) | null = null;

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
  try { localStorage.clear(); } catch { /* ignore */ }

  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ written: ["app/page.tsx"], failed: [] }),
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
      readText: vi.fn().mockResolvedValue(""),
    },
  });
});

afterEach(() => {
  if (unmountOverlay) {
    act(() => unmountOverlay!());
    unmountOverlay = null;
  }
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  styleEngine.resetAll();
  resetAllModeOverrides();
});

/** Mount Overlay, select `el` via the programmatic event, give it an edit. */
async function mountWithSelection(el: HTMLElement) {
  const { unmount, container } = render(<Overlay />);
  unmountOverlay = unmount;
  styleEngine.apply({ scope: "element", el }, "color", "red");
  await act(async () => {
    document.dispatchEvent(new CustomEvent("tuner:select", { detail: el }));
    await flushMicrotasks();
  });
  return container;
}

describe("Cmd+S → saveRef end-to-end (Issue 5)", () => {
  it("with the Footer mounted, Cmd+S fires the real Footer save pipeline", async () => {
    const el = makeEl();
    await mountWithSelection(el);

    await act(async () => {
      pressCmdS();
      await flushMicrotasks();
    });

    // The REAL pipeline ran: one POST carrying the edit.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0]).toMatchObject({ prop: "color", to: "red" });

    // And the save announcement reached the live region.
    const live = document.querySelector('[aria-live="assertive"]');
    expect(live?.textContent).toContain("Saved");
  });
});

describe("Cmd+S with the Footer unmounted (Issue 3)", () => {
  it("announces 'Open the style panel to save' instead of silently doing nothing", async () => {
    const el = makeEl();
    const container = await mountWithSelection(el);

    // Open the Variables panel from the Toolbar — selectedEl stays set, the
    // inspector (and Footer) unmounts, saveRef.current goes null.
    const variablesBtn = container.querySelector('[aria-label="Variables"]') as HTMLElement;
    expect(variablesBtn, "Toolbar Variables button should be rendered").toBeTruthy();
    await act(async () => {
      variablesBtn.click();
      await flushMicrotasks();
    });

    await act(async () => {
      pressCmdS();
      await flushMicrotasks();
    });

    // No save happened (Footer is gone)...
    expect(fetchMock).not.toHaveBeenCalled();

    // ...but the user MUST hear about it. THE BUG: pre-fix there is no live
    // region mounted at all in this state, and nothing is announced.
    const live = document.querySelector('[aria-live="assertive"]');
    expect(live, "aria live region must be mounted even without the inspector").toBeTruthy();
    expect(live!.textContent).toContain("Open the style panel to save");
  });
});
