/**
 * managedSheet.ts — CSP-compatible runtime style injection (ADR-0009).
 *
 * Backs each named sheet with a `new CSSStyleSheet()` + `replaceSync()` and
 * registers it on `document.adoptedStyleSheets`. Falls back to a `<style>`
 * element in browsers without `adoptedStyleSheets`.
 *
 * Contract — append, don't assign. The helper appends its sheet via
 * `[...adoptedStyleSheets, sheet]` and removes via filter; clearing the
 * array would clobber host-app, devtool, or shadow-root adopted sheets.
 */

interface ModernEntry {
  kind: "modern";
  sheet: CSSStyleSheet;
  /** Last CSS string passed to replace(); used by the test-only reader so
   *  assertions see the source text instead of CSSOM-normalized output. */
  lastCss: string;
}

interface FallbackEntry {
  kind: "fallback";
  styleEl: HTMLStyleElement;
}

type Entry = ModernEntry | FallbackEntry;

const entries = new Map<string, Entry>();

function supportsConstructable(): boolean {
  return (
    typeof CSSStyleSheet !== "undefined" &&
    typeof Document !== "undefined" &&
    "adoptedStyleSheets" in Document.prototype
  );
}

const IMPORT_RE = /^\s*@import\b/m;

function ensureEntry(key: string): Entry {
  let entry = entries.get(key);
  if (entry) return entry;
  if (supportsConstructable()) {
    const sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    entry = { kind: "modern", sheet, lastCss: "" };
  } else {
    const styleEl = document.createElement("style");
    document.head.appendChild(styleEl);
    entry = { kind: "fallback", styleEl };
  }
  entries.set(key, entry);
  return entry;
}

export interface ManagedSheetHandle {
  replace(css: string): void;
  dispose(): void;
}

export function managedSheet(key: string): ManagedSheetHandle {
  return {
    replace(css: string): void {
      if (IMPORT_RE.test(css)) {
        throw new Error(
          "managedSheet: @import rules are not supported. constructable stylesheets reject @import; flatten via postcss before passing in.",
        );
      }
      const entry = ensureEntry(key);
      if (entry.kind === "modern") {
        entry.sheet.replaceSync(css);
        entry.lastCss = css;
      } else {
        entry.styleEl.textContent = css;
      }
    },
    dispose(): void {
      const entry = entries.get(key);
      if (!entry) return;
      if (entry.kind === "modern") {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
          (s) => s !== entry.sheet,
        );
      } else {
        entry.styleEl.remove();
      }
      entries.delete(key);
    },
  };
}

/** Read the CSS source written via replace(), or null if not registered. Test-only. */
export function _readManagedSheetCss(key: string): string | null {
  const entry = entries.get(key);
  if (!entry) return null;
  if (entry.kind === "modern") return entry.lastCss;
  return entry.styleEl.textContent ?? "";
}
