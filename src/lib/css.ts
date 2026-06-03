/**
 * css.ts — pure CSS identifier/value predicates.
 *
 * Shared by the live preview (overlay, browser) and the source-file commit
 * path (server, Node). No DOM dependencies, so it is safe to import from both
 * sides — this is the single source of truth for "what counts as a valid CSS
 * property / class name / value", keeping the client preview and the server
 * write path from drifting apart.
 */

/**
 * CSS property name: a custom property (`--foo`) or a kebab ident, allowing a
 * leading vendor hyphen (`-webkit-transform`).
 */
export function isValidCSSProp(prop: string): boolean {
  return /^--[\w-]+$/.test(prop) || /^-?[a-z][a-z-]*$/.test(prop);
}

/** A single CSS class identifier (no braces, semicolons, or whitespace). */
export function isValidCSSClassName(name: string): boolean {
  return /^-?[_a-zA-Z][\w-]*$/.test(name);
}

/**
 * Reject a declaration value that could break out of its block or statement.
 * Used by the commit path, which rejects bad input rather than mutating it.
 */
export function isSafeCSSValue(value: string): boolean {
  return !/[{};<]/.test(value) && !/[\r\n]/.test(value);
}

/**
 * CSS properties whose value grammar does NOT accept the keyword `none`.
 *
 * The panel's single-select toggle controls (IconButtonGroup) use `none` as a
 * deselect sentinel — clicking the already-active option emits onChange("none").
 * For these properties that sentinel is INVALID CSS, so the write layer must
 * drop it rather than persist `box-sizing: none` etc. to source. See the
 * toggle-deselect bug class (toggleDeselectGuard.test.tsx, resolved-bugs memory).
 *
 * This is a DENY-list by design: a missing entry merely means a future toggle
 * bug is not auto-caught (degrades to the status quo), whereas an allow-list
 * could wrongly reject a legitimate `none` (`display:none`, `border:none`,
 * `transform:none`, …) — a worse failure than the bug it guards against. Add a
 * property here only when `none` is genuinely not part of its CSS grammar.
 */
export const PROPS_REJECTING_NONE: ReadonlySet<string> = new Set([
  "box-sizing", // content-box | border-box
  "text-align", // start | end | left | right | center | justify | match-parent
  "justify-content", // normal | <content-distribution> | <content-position>
  "align-content", //   (same family — no `none`)
  "align-items", //     normal | stretch | <baseline-position> | <self-position>
  "justify-items", //   (same family + legacy — no `none`)
  "flex-direction", //  row | row-reverse | column | column-reverse
  "flex-wrap", //       nowrap | wrap | wrap-reverse
]);

/**
 * Semantic-validity guard — distinct from `isSafeCSSValue` (which is the
 * injection/syntax check). Returns true when `value` is grammatically invalid
 * for `prop` and therefore must not be applied to the DOM or written to source.
 *
 * Currently encodes the `none`-sentinel toggle-deselect class (see
 * PROPS_REJECTING_NONE); extend here as new known-invalid combinations surface.
 * Custom properties (`--*`) accept any value and are never flagged.
 */
export function isInvalidDeclaration(prop: string, value: string): boolean {
  return value.trim() === "none" && PROPS_REJECTING_NONE.has(prop);
}

/**
 * Strip characters that could break out of a CSS value context. Used by the
 * live-preview `<style>` writer, which mutates rather than rejects.
 */
export function sanitizeCSSValue(value: string): string {
  return (
    value
      .replace(/[{}]/g, "")
      // HTML end tags tolerate whitespace before `>` (`</style\t>`, `</style >`),
      // so a `>`-anchored strip is bypassable. Match whitespace-tolerantly,
      // case-insensitively, and globally so a padded close tag can't break out
      // of the live-preview <style> element.
      .replace(/<\/style\s*>/gi, "")
      // A CSS declaration value never legitimately contains `<`; drop any that
      // remain so no markup can escape the <style> context, however malformed.
      .replace(/</g, "")
  );
}
