/**
 * managedSheet.ts — CSP-compatible runtime style injection (ADR-0009).
 *
 * Backs each named sheet with a `new CSSStyleSheet()` + `replaceSync()` and
 * registers it on the target's `adoptedStyleSheets`. The target defaults to
 * `document` so existing host-document-bound sites keep their behavior; pass a
 * `ShadowRoot` to adopt the sheet into the overlay's shadow boundary
 * (ADR-0008). Falls back to a `<style>` element in browsers without
 * `adoptedStyleSheets`.
 *
 * Contract — append, don't assign. The helper appends its sheet via
 * `[...adoptedStyleSheets, sheet]` and removes via filter; clearing the
 * array would clobber host-app, devtool, or sibling adopted sheets.
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

export type SheetTarget = Document | ShadowRoot;

const entriesByTarget = new WeakMap<SheetTarget, Map<string, Entry>>();

function entriesFor(target: SheetTarget): Map<string, Entry> {
  let map = entriesByTarget.get(target);
  if (!map) {
    map = new Map();
    entriesByTarget.set(target, map);
  }
  return map;
}

function supportsConstructable(target: SheetTarget): boolean {
  if (typeof CSSStyleSheet === "undefined") return false;
  // Both Document and ShadowRoot expose `adoptedStyleSheets` in modern browsers.
  return "adoptedStyleSheets" in target;
}

function fallbackHost(target: SheetTarget): Node {
  // Document: append to <head>. ShadowRoot: append to the shadow root itself.
  // happy-dom's Document occasionally fails an `instanceof Document` check
  // against the realm-level constructor, so duck-type on `.head` instead.
  const head = (target as Document).head as HTMLHeadElement | undefined;
  return head ?? target;
}

const IMPORT_RE = /^\s*@import\b/m;

function ensureEntry(key: string, target: SheetTarget): Entry {
  const map = entriesFor(target);
  let entry = map.get(key);
  if (entry) return entry;
  if (supportsConstructable(target)) {
    const sheet = new CSSStyleSheet();
    target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    entry = { kind: "modern", sheet, lastCss: "" };
  } else {
    const ownerDocument =
      "createElement" in target
        ? (target as Document)
        : (target as ShadowRoot).ownerDocument ?? document;
    const styleEl = ownerDocument.createElement("style");
    fallbackHost(target).appendChild(styleEl);
    entry = { kind: "fallback", styleEl };
  }
  map.set(key, entry);
  return entry;
}

export interface ManagedSheetHandle {
  replace(css: string): void;
  dispose(): void;
}

export function managedSheet(
  key: string,
  target: SheetTarget = document,
): ManagedSheetHandle {
  return {
    replace(css: string): void {
      if (IMPORT_RE.test(css)) {
        throw new Error(
          "managedSheet: @import rules are not supported. constructable stylesheets reject @import; flatten via postcss before passing in.",
        );
      }
      const entry = ensureEntry(key, target);
      if (entry.kind === "modern") {
        entry.sheet.replaceSync(css);
        entry.lastCss = css;
      } else {
        entry.styleEl.textContent = css;
      }
    },
    dispose(): void {
      const map = entriesByTarget.get(target);
      const entry = map?.get(key);
      if (!entry || !map) return;
      if (entry.kind === "modern") {
        target.adoptedStyleSheets = target.adoptedStyleSheets.filter(
          (s) => s !== entry.sheet,
        );
      } else {
        entry.styleEl.remove();
      }
      map.delete(key);
    },
  };
}

/** Read the CSS source written via replace(), or null if not registered. Test-only. */
export function _readManagedSheetCss(
  key: string,
  target: SheetTarget = document,
): string | null {
  const entry = entriesByTarget.get(target)?.get(key);
  if (!entry) return null;
  if (entry.kind === "modern") return entry.lastCss;
  return entry.styleEl.textContent ?? "";
}
