// @vitest-environment happy-dom
/**
 * exportBreakpointComposition.test.tsx — Bug B of the breakpoint-export
 * consolidation: **copy/export surfaces flatten breakpoint changes into the
 * un-mediated base rule.**
 *
 * Footer's Copy CSS/SCSS got the base-vs-@media partition right (#35), but the
 * parallel copies of the same logic did not: Cmd+C and the ChangesDrawer
 * "Copy All" call the breakpoint-blind `formatCSSDiff` directly, and Copy
 * Tailwind flattens instead of prefixing `sm:`/`md:`/`lg:`/`xl:`
 * (640/768/1024/1280 map 1:1 onto Tailwind's responsive scale).
 *
 * The fix moves the partition into the shared layer (`composeExportCSS` /
 * `composeTailwindExport` in breakpoints.ts) and routes every copy surface
 * through it.
 *
 * RED before the fix: the drawer's Copy All emits `width: 100px` inside the
 * base rule with no @media block; Copy Tailwind emits `w-[100px]` with no
 * `md:` prefix.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChangesDrawer } from "../shell/ChangesDrawer";
import { Footer } from "../shell/Footer";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";

function makeEl(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

async function flushMicrotasks() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

let container: HTMLDivElement;
let root: Root;
let clipboardWrites: string[];

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

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
  styleEngine.resetAll();
  resetAllModeOverrides();
});

describe("ChangesDrawer Copy All — base vs @media partition", () => {
  it("emits breakpoint changes inside @media blocks, not flattened into the base rule", async () => {
    const el = makeEl("drawer-el");
    styleEngine.apply({ scope: "element", el }, "color", "red"); // base
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "width", "100px"); // responsive

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

    const copyBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Copy All",
    );
    expect(copyBtn, "Copy All button should be rendered").toBeTruthy();

    await act(async () => {
      copyBtn!.click();
      await flushMicrotasks();
    });

    expect(clipboardWrites).toHaveLength(1);
    const css = clipboardWrites[0];

    // The responsive edit must live in a real @media block...
    expect(css).toContain("@media (min-width: 768px)");
    const mediaBlock = css.slice(css.indexOf("@media"));
    expect(mediaBlock).toContain("width: 100px");

    // ...and must NOT be flattened into the un-mediated base rule.
    const baseRule = css.slice(0, css.indexOf("@media"));
    expect(baseRule).toContain("color: red");
    expect(baseRule, "breakpoint change leaked into the base rule").not.toContain("width: 100px");
  });
});

describe("Footer Copy Tailwind — responsive prefixes", () => {
  it("prefixes breakpoint changes with the matching Tailwind responsive variant", async () => {
    const el = makeEl("tw-el");
    styleEngine.apply({ scope: "element", el }, "gap", "8px"); // base → gap-2
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "display", "flex"); // → md:flex

    await act(async () => {
      root.render(<Footer element={el} onReset={() => {}} />);
    });

    // Open the Clipboard dropdown, then click "Tailwind".
    const trigger = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Clipboard"),
    );
    expect(trigger).toBeTruthy();
    await act(async () => { trigger!.click(); });

    const twItem = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Tailwind",
    );
    expect(twItem, "Tailwind copy item should be rendered").toBeTruthy();

    await act(async () => {
      twItem!.click();
      await flushMicrotasks();
    });

    expect(clipboardWrites).toHaveLength(1);
    const tw = clipboardWrites[0];
    const tokens = tw.split(/\s+/);

    expect(tokens).toContain("gap-2");
    // THE BUG: pre-fix this is a bare "flex" — flattened to base.
    expect(tokens, "768px edit must carry the md: prefix").toContain("md:flex");
    expect(tokens).not.toContain("flex");
  });
});

describe("Footer Copy CSS Variables — base vs @media partition (review round 2, Issue 4)", () => {
  it("wraps breakpoint-tagged vars in @media blocks instead of flattening into one :root", async () => {
    const el = makeEl("vars-el");
    styleEngine.apply({ scope: "element", el }, "width", "100px"); // base
    styleEngine.apply({ scope: "element", el, breakpoint: "768" }, "width", "50px"); // responsive

    await act(async () => {
      root.render(<Footer element={el} onReset={() => {}} />);
    });

    const trigger = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Clipboard"),
    );
    expect(trigger).toBeTruthy();
    await act(async () => { trigger!.click(); });

    const varsItem = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "CSS Variables",
    );
    expect(varsItem, "CSS Variables copy item should be rendered").toBeTruthy();

    await act(async () => {
      varsItem!.click();
      await flushMicrotasks();
    });

    expect(clipboardWrites).toHaveLength(1);
    const out = clipboardWrites[0];

    // THE BUG: pre-fix both widths land flat in one :root{} (last one wins).
    expect(out, "responsive var must live in an @media block").toContain("@media (min-width: 768px)");

    const baseBlock = out.slice(0, out.indexOf("@media"));
    expect(baseBlock).toContain("--width: 100px");
    expect(baseBlock, "breakpoint var leaked into the base :root").not.toContain("--width: 50px");

    const mediaBlock = out.slice(out.indexOf("@media"));
    expect(mediaBlock).toContain(":root");
    expect(mediaBlock).toContain("--width: 50px");
  });
});

describe("shared composer (breakpoints.ts) — unit coverage", () => {
  it("composeExportCSS partitions base vs breakpoint changes across multiple elements", async () => {
    const { composeExportCSS } = await import("../breakpoints");
    const { formatCSSDiff } = await import("../util");

    const a = makeEl("el-a");
    a.className = "card-a";
    const b = makeEl("el-b");
    b.className = "card-b";
    const items = [
      {
        el: a,
        changes: [
          { prop: "color", from: "black", to: "red" },
          { prop: "width", from: "auto", to: "100px", breakpoint: "768" },
        ],
      },
      {
        el: b,
        changes: [{ prop: "gap", from: "0px", to: "8px", breakpoint: "1024" }],
      },
    ];

    const css = composeExportCSS(items, formatCSSDiff);

    // Base rule for `a` only (b has no base changes → no empty rule noise).
    expect(css).toContain("color: red");
    expect(css).toContain(".card-a");
    expect(css).not.toMatch(/\.card-b\s*\{\s*\}/);

    // @media blocks ascend and carry the right declarations.
    expect(css.indexOf("min-width: 768px")).toBeLessThan(css.indexOf("min-width: 1024px"));
    expect(css.slice(css.indexOf("@media"))).toContain("width: 100px");
    expect(css.slice(css.indexOf("@media"))).toContain("gap: 8px");

    // Base block must not contain the responsive declarations.
    const baseBlock = css.slice(0, css.indexOf("@media"));
    expect(baseBlock).not.toContain("width: 100px");
    expect(baseBlock).not.toContain("gap: 8px");
  });

  it("composeTailwindExport maps 640/768/1024/1280 onto sm:/md:/lg:/xl:", async () => {
    const { composeTailwindExport } = await import("../breakpoints");
    const tw = composeTailwindExport([
      { prop: "gap", from: "0px", to: "8px" },
      { prop: "display", from: "block", to: "flex", breakpoint: "640" },
      { prop: "display", from: "block", to: "grid", breakpoint: "768" },
      { prop: "gap", from: "0px", to: "16px", breakpoint: "1024" },
      { prop: "gap", from: "0px", to: "24px", breakpoint: "1280" },
    ]);
    const tokens = tw.split(/\s+/);
    expect(tokens).toContain("gap-2");
    expect(tokens).toContain("sm:flex");
    expect(tokens).toContain("md:grid");
    expect(tokens).toContain("lg:gap-4");
    expect(tokens).toContain("xl:gap-6");
  });

  it("Cmd+C and Copy All route through the shared composer (no breakpoint-blind formatCSSDiff calls)", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const overlaySrc = readFileSync(join(__dirname, "..", "shell", "Overlay.tsx"), "utf-8");
    const drawerSrc = readFileSync(join(__dirname, "..", "shell", "ChangesDrawer.tsx"), "utf-8");
    const footerSrc = readFileSync(join(__dirname, "..", "shell", "Footer.tsx"), "utf-8");

    // formatCSSDiff is a BASE formatter now — it may only appear as an argument
    // to composeExportCSS, never invoked directly on a full diff.
    expect(overlaySrc).not.toMatch(/formatCSSDiff\(/);
    expect(drawerSrc).not.toMatch(/formatCSSDiff\(/);
    // Footer's private composer is gone — one shared partition in breakpoints.ts.
    expect(footerSrc).not.toContain("const composeExportCSS");
    expect(footerSrc).toContain("composeExportCSS");
  });
});
