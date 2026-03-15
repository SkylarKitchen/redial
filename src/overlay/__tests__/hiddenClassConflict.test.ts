import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Tailwind `hidden` class + JS display toggling conflict test.
 *
 * With `important: true` in tailwind.config.ts, the `hidden` utility becomes
 * `display: none !important`. JavaScript `element.style.display = "block"`
 * sets a normal inline style (no !important), so the CSS rule wins and the
 * element stays invisible.
 *
 * Overlay elements whose visibility is toggled by JS (outlines, badges, labels)
 * must NOT use Tailwind's `hidden` class. They should use inline
 * `style={{ display: 'none' }}` as initial state instead.
 */
describe("Overlay elements must not use Tailwind hidden class for JS-toggled visibility", () => {
  const overlayPath = join(__dirname, "../shell/Overlay.tsx");
  const source = readFileSync(overlayPath, "utf-8");

  // These are elements whose display is toggled via JS ref manipulation
  // (e.g. `outlineRef.current.style.display = "block"`)
  const jsToggledRefs = [
    "selectedOutlineRef",
    "ancestorOutlineRef",
    "dimensionsBadgeRef",
    "tagLabelRef",
  ];

  for (const refName of jsToggledRefs) {
    it(`${refName} element should not use Tailwind "hidden" class`, () => {
      // Find the JSX element that uses this ref
      const refPattern = new RegExp(
        `ref=\\{${refName}\\}[^>]*className="([^"]*)"`,
        "s"
      );
      const match = source.match(refPattern);

      if (!match) {
        // Try reverse order: className before ref
        const altPattern = new RegExp(
          `className="([^"]*)"[^>]*ref=\\{${refName}\\}`,
          "s"
        );
        const altMatch = source.match(altPattern);

        if (altMatch) {
          const classList = altMatch[1].split(/\s+/);
          expect(classList).not.toContain("hidden");
        }
        return;
      }

      const classList = match[1].split(/\s+/);
      expect(
        classList,
        `${refName} uses Tailwind "hidden" class which becomes display:none!important ` +
        `and cannot be overridden by JS inline styles. Use style={{ display: 'none' }} instead.`
      ).not.toContain("hidden");
    });
  }
});
