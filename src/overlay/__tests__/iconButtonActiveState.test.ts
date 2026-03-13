import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * iconButtonActiveState.test.ts
 *
 * With `important: true` in tailwind.config.ts, Shadcn's ToggleGroupItem
 * base class applies `data-[state=on]:bg-accent` and
 * `data-[state=on]:text-accent-foreground` with !important.
 *
 * This means inline `backgroundColor` / `color` set for the active state
 * are silently overridden → icon becomes invisible (white-on-white or
 * nearly invisible gray-on-transparent).
 *
 * Active state styling MUST use Tailwind classes (e.g.
 * data-[state=on]:bg-primary) so tailwind-merge can resolve conflicts.
 */

const ICON_BUTTON_GROUP = join(__dirname, "../IconButtonGroup.tsx");

describe("IconButtonGroup active state uses Tailwind classes, not inline styles", () => {
  const source = readFileSync(ICON_BUTTON_GROUP, "utf-8");

  it("does not set inline backgroundColor for active state (overridden by !important)", () => {
    // Look for patterns like: backgroundColor: isActive ? ... : ...
    // These inline styles lose to data-[state=on]:bg-accent !important
    const hasInlineActiveBg = /backgroundColor:\s*isActive\s*\?/.test(source);
    expect(
      hasInlineActiveBg,
      "Inline backgroundColor conditional on isActive will be overridden by Tailwind !important. Use data-[state=on]:bg-primary className instead.",
    ).toBe(false);
  });

  it("does not set inline color for active state (overridden by !important)", () => {
    // Look for patterns like: color: isActive ? ... : ...
    const hasInlineActiveColor = /\bcolor:\s*isActive\s*\?/.test(source);
    expect(
      hasInlineActiveColor,
      "Inline color conditional on isActive will be overridden by Tailwind !important. Use data-[state=on]:text-primary-foreground className instead.",
    ).toBe(false);
  });

  it("uses data-[state=on] Tailwind overrides for active background", () => {
    expect(source).toContain("data-[state=on]:bg-primary");
  });

  it("uses data-[state=on] Tailwind overrides for active text color", () => {
    expect(source).toContain("data-[state=on]:text-primary-foreground");
  });
});
