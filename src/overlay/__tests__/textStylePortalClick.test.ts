// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Bug: Typography Style dropdown items cannot be clicked.
 *
 * Root cause: The TextStyleRow renders its dropdown via a React portal
 * to `document.body` with `data-textstyle-portal`. However, the
 * `handlePageClick` capture-phase handler in Overlay.tsx checks for
 * known portal attributes (`[data-tuner-portal]`, `[data-radix-portal]`)
 * and calls `e.stopPropagation()` on anything else — swallowing
 * the click before cmdk's `onClick` can fire `onSelect`.
 *
 * Fix: Add `[data-textstyle-portal]` to the allowlist in handlePageClick.
 */

describe("TextStyleRow portal click-through", () => {
  // The page-click handler lives in hooks/usePageInteractions.ts (extracted from Overlay.tsx)
  const overlaySource = readFileSync(
    join(__dirname, "..", "hooks", "usePageInteractions.ts"),
    "utf-8",
  );

  it("handlePageClick allowlist includes data-textstyle-portal", () => {
    // The capture-phase click handler must allow clicks through to the
    // text style portal, just like it does for [data-tuner-portal] and
    // [data-radix-portal].
    expect(overlaySource).toContain('[data-textstyle-portal]');
  });

  it("both target.closest and elementFromPoint checks include textstyle-portal", () => {
    // There are TWO guard checks in handlePageClick:
    // 1. target.closest("[data-textstyle-portal]") — direct target check
    // 2. el.closest("[data-textstyle-portal]") — elementFromPoint check
    // Both must include the textstyle portal.
    const closestMatches = overlaySource.match(
      /\.closest\(\s*["'][^"']*data-textstyle-portal[^"']*["']\s*\)/g,
    );
    expect(closestMatches).toBeTruthy();
    expect(closestMatches!.length).toBeGreaterThanOrEqual(2);
  });
});
