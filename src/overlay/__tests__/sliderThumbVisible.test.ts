/**
 * sliderThumbVisible.test.ts — Ensure the slider thumb (knob) is visible.
 *
 * Bug: The Radix Slider Thumb had `bg-transparent border-transparent`,
 * making the draggable knob completely invisible. The track shows but
 * there's no affordance to grab.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const sliderPath = join(__dirname, "../../components/ui/slider.tsx");

describe("slider thumb visibility", () => {
  const content = readFileSync(sliderPath, "utf-8");

  it("Thumb should not have bg-transparent (knob must be visible)", () => {
    // Extract the Thumb className
    const thumbMatch = content.match(/Thumb\s+className="([^"]+)"/);
    expect(thumbMatch, "Could not find SliderPrimitive.Thumb className").toBeTruthy();
    const thumbClasses = thumbMatch![1];
    expect(thumbClasses).not.toMatch(/\bbg-transparent\b/);
  });

  it("Thumb should not have border-transparent (knob must be visible)", () => {
    const thumbMatch = content.match(/Thumb\s+className="([^"]+)"/);
    expect(thumbMatch).toBeTruthy();
    const thumbClasses = thumbMatch![1];
    expect(thumbClasses).not.toMatch(/\bborder-transparent\b/);
  });

  it("Thumb should have a visible default background color (not just on focus)", () => {
    const thumbMatch = content.match(/Thumb\s+className="([^"]+)"/);
    expect(thumbMatch).toBeTruthy();
    const thumbClasses = thumbMatch![1];
    // Extract non-prefixed bg- classes (no focus-visible:, hover:, etc.)
    const defaultBgClasses = thumbClasses
      .split(/\s+/)
      .filter((c) => c.startsWith("bg-") && !c.includes(":"));
    // Should have a visible default bg (not transparent)
    const hasVisibleBg = defaultBgClasses.some(
      (c) => c !== "bg-transparent" && c !== "bg-none",
    );
    expect(
      hasVisibleBg,
      `Default bg classes are: ${defaultBgClasses.join(", ") || "(none)"}`,
    ).toBe(true);
  });

  it("Thumb should have a visible default border (not just on focus)", () => {
    const thumbMatch = content.match(/Thumb\s+className="([^"]+)"/);
    expect(thumbMatch).toBeTruthy();
    const thumbClasses = thumbMatch![1];
    // Extract non-prefixed border- classes
    const defaultBorderClasses = thumbClasses
      .split(/\s+/)
      .filter((c) => c.startsWith("border-") && !c.includes(":"));
    const hasVisibleBorder = defaultBorderClasses.some(
      (c) => c !== "border-transparent" && c !== "border-none",
    );
    expect(
      hasVisibleBorder,
      `Default border classes are: ${defaultBorderClasses.join(", ") || "(none)"}`,
    ).toBe(true);
  });
});
