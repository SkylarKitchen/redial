/**
 * transition-menu.test.ts — Verify the transition options menu exists
 * in EffectsSection.tsx with all required actions.
 *
 * Uses source-level static analysis (matching existing test patterns).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const effectsSrc = readFileSync(
  join(__dirname, "..", "EffectsSection.tsx"),
  "utf-8",
);

describe("Transition options menu", () => {
  it("has menu anchor state (not a no-op)", () => {
    expect(effectsSrc).toMatch(/transMenuAnchor/);
  });

  it("onMenu handler is wired (no TODO stub)", () => {
    // The old code had: onMenu={() => { /* TODO: transition options menu */ }}
    expect(effectsSrc).not.toMatch(/TODO.*transition.*menu/i);
  });

  it('has "Remove All" action', () => {
    expect(effectsSrc).toMatch(/Remove All/);
  });

  it('has "Copy CSS" action', () => {
    expect(effectsSrc).toMatch(/Copy CSS/);
  });

  it('has "Disable All" / "Enable All" toggle', () => {
    expect(effectsSrc).toMatch(/Disable All/);
    expect(effectsSrc).toMatch(/Enable All/);
  });

  it("uses createPortal for the menu", () => {
    expect(effectsSrc).toMatch(/createPortal/);
  });

  it("uses data-tuner-portal attribute", () => {
    expect(effectsSrc).toMatch(/data-tuner-portal/);
  });
});
