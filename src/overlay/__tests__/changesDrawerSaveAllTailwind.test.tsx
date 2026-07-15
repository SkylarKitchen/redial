// @vitest-environment happy-dom
/**
 * Regression for issue #41: ChangesDrawer "Save All" must route Tailwind
 * elements through enrichChangesForCommit() and include `mode: "tailwind"`
 * in the POST body, matching Footer.tsx and Overlay.tsx Cmd+S behavior.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChangesDrawer } from "../shell/ChangesDrawer";
import { applyInlineStyle, resetAll } from "../core/apply";
import { __setTransportForTests, type SaveTransport } from "../core/save";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeTailwindEl(): HTMLElement {
  const el = document.createElement("div");
  // 3+ tailwind utility classes → isTailwindElement returns true
  el.className = "flex items-center gap-2 p-4";
  document.body.appendChild(el);
  return el;
}

async function flushMicrotasks() {
  // Allow the async handleSaveAll promise chain to resolve
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// ─── Setup ────────────────────────────────────────────────────────────

let container: HTMLDivElement;
let root: Root;
let transportMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  // Inject a transport to capture the commit body and return a fake success.
  transportMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ written: ["app/page.tsx"], failed: [] }),
  });
  __setTransportForTests(transportMock as unknown as SaveTransport);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  document.body.innerHTML = "";
  __setTransportForTests(null);
  resetAll();
});

// ─── Test ─────────────────────────────────────────────────────────────

describe("ChangesDrawer Save All — Tailwind path", () => {
  it("POSTs with mode: 'tailwind' and enriched changes for Tailwind elements", async () => {
    // Arrange: create a Tailwind-classified element and apply an override
    // so diffAll() returns a pending change for it.
    const el = makeTailwindEl();
    applyInlineStyle(el, "color", "red");

    // Render the drawer in its "pending" tab.
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

    // Find the "Save All" button.
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Save All",
    );
    expect(saveBtn, "Save All button should be rendered").toBeTruthy();

    // Act: click Save All.
    await act(async () => {
      saveBtn!.click();
      await flushMicrotasks();
    });

    // Assert: the commit transport was called once (a single tailwind batch).
    expect(transportMock).toHaveBeenCalledTimes(1);

    const [body] = transportMock.mock.calls[0];

    // Contract from Footer.tsx / Overlay.tsx:
    //   body = { mode: "tailwind", changes: [...enriched] }
    expect(body.mode).toBe("tailwind");

    // enrichChangesForCommit returns Tailwind shape with newClasses/existingClasses,
    // which the old inline builder did NOT produce.
    expect(Array.isArray(body.changes)).toBe(true);
    expect(body.changes.length).toBeGreaterThan(0);
    const change = body.changes[0];
    expect(change.mode).toBe("tailwind");
    expect(typeof change.newClasses).toBe("string");
    expect(typeof change.existingClasses).toBe("string");
    expect(change.existingClasses).toContain("flex");
  });
});
