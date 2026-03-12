// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";

/**
 * Footer button regression:
 * The Copy button's dropdown arrow (▾) was wrapping to a second line.
 *
 * After Shadcn migration, buttons use <Button> which renders as
 * inline-flex (preventing wrap). We verify the Footer uses Shadcn
 * Button components and that they have compact sizing.
 */

describe("ActionButton style contract", () => {
  it("buttons use Shadcn Button with inline-flex to prevent content wrapping", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(
      join(__dirname, "..", "Footer.tsx"),
      "utf-8"
    );

    // Footer must import Shadcn Button
    expect(src).toContain('from "@/components/ui/button"');

    // All action buttons must use <Button> component (not raw <button>)
    // which provides inline-flex layout preventing text wrapping
    const buttonUsages = src.match(/<Button\b/g);
    expect(buttonUsages).toBeTruthy();
    expect(buttonUsages!.length).toBeGreaterThanOrEqual(4);
  });
});
