// @vitest-environment happy-dom
/**
 * invalidValueGuard.test.ts — semantic-validity guard at the WRITE layer.
 *
 * Defense-in-depth for the "toggle-deselect on an inherited default" bug class
 * (see toggleDeselectGuard.test.tsx + resolved-bugs memory). That class was
 * fixed per-control with `allowDeselect={false}`, but every NEW single-select
 * toggle is a fresh chance to forget the prop and emit a deselect `"none"`.
 *
 * The leak mechanism: a single-select IconButtonGroup deselect emits
 * onChange("none"). For properties whose CSS grammar has no `none`
 * (box-sizing, text-align, justify-content, …) the browser silently REJECTS
 * the inline write, so the live DOM looks fine — but apply.ts still records
 * `current: "none"` in the overrides map, so it flows into diff() → localStorage
 * → the source-file commit path as invalid CSS (`box-sizing: none`).
 *
 * The guard: a pure predicate `isInvalidDeclaration(prop, value)` in
 * src/lib/css.ts (the single source of truth shared by browser + server) that
 * the write layer consults to drop the value instead of persisting it. It is a
 * DENY-list of props where `none` is invalid: a missing entry degrades to the
 * status quo (uncaught), whereas an allow-list could wrongly reject a legit
 * `none` (display:none, border:none) — a worse failure than the bug.
 *
 * NOTE on environment: happy-dom's CSS.supports() is a stub that returns true
 * for everything (even `box-sizing: none`), and its setProperty accepts invalid
 * values — so a CSS.supports-based guard is neither testable here nor available
 * in the Node commit path. The deterministic predicate works in both.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { isInvalidDeclaration } from "../../lib/css";
import { applyInlineStyle, diff, totalOverrideCount, resetAll } from "../core/apply";

// ── The pure predicate ───────────────────────────────────────────────

describe("isInvalidDeclaration — semantic-validity predicate", () => {
  // Properties whose grammar has no `none` AND that the panel toggles (or may).
  const NONE_INVALID = [
    "box-sizing",
    "text-align",
    "justify-content",
    "align-content",
    "align-items",
    "justify-items",
    "flex-direction",
    "flex-wrap",
  ];

  it.each(NONE_INVALID)("flags `%s: none` as invalid", (prop) => {
    expect(isInvalidDeclaration(prop, "none")).toBe(true);
  });

  it("tolerates surrounding whitespace on the value", () => {
    expect(isInvalidDeclaration("box-sizing", "  none  ")).toBe(true);
  });

  // Must NOT over-reject: these properties have a legitimate `none`.
  const NONE_VALID = [
    "display",
    "border",
    "border-style",
    "outline",
    "outline-style",
    "transform",
    "box-shadow",
    "text-decoration-line",
    "float",
    "clear",
    "text-transform",
    "background",
    "max-width",
    "pointer-events",
  ];

  it.each(NONE_VALID)("does NOT flag `%s: none` (none is valid there)", (prop) => {
    expect(isInvalidDeclaration(prop, "none")).toBe(false);
  });

  it("never flags a custom property", () => {
    expect(isInvalidDeclaration("--my-box-sizing", "none")).toBe(false);
  });

  it("does NOT flag a legitimate value on a none-invalid prop", () => {
    expect(isInvalidDeclaration("box-sizing", "border-box")).toBe(false);
    expect(isInvalidDeclaration("text-align", "center")).toBe(false);
    expect(isInvalidDeclaration("justify-content", "stretch")).toBe(false);
  });
});

// ── apply.ts integration: the leak must be plugged at the source ──────

describe("applyInlineStyle drops semantically-invalid `none`", () => {
  beforeEach(() => {
    resetAll();
    document.body.innerHTML = "";
  });

  function makeEl(tag = "div"): HTMLElement {
    const el = document.createElement(tag);
    document.body.appendChild(el);
    return el;
  }

  it("does not record `box-sizing: none` as an override", () => {
    const el = makeEl();
    applyInlineStyle(el, "box-sizing", "none");
    expect(diff(el).some((d) => d.prop === "box-sizing")).toBe(false);
    expect(totalOverrideCount()).toBe(0);
  });

  it("does not record an invalid `none` on a state-keyed property", () => {
    const el = makeEl();
    applyInlineStyle(el, "hover::justify-content", "none");
    expect(diff(el).some((d) => d.prop === "justify-content")).toBe(false);
    expect(totalOverrideCount()).toBe(0);
  });

  it("still records a legitimate value (no over-rejection)", () => {
    const el = makeEl();
    applyInlineStyle(el, "box-sizing", "border-box");
    expect(diff(el).some((d) => d.prop === "box-sizing" && d.to === "border-box")).toBe(true);
  });

  it("still records a legitimate `none` where none is valid (display)", () => {
    const el = makeEl();
    applyInlineStyle(el, "display", "none");
    expect(diff(el).some((d) => d.prop === "display" && d.to === "none")).toBe(true);
  });
});
