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
 * Strip characters that could break out of a CSS value context. Used by the
 * live-preview `<style>` writer, which mutates rather than rejects.
 */
export function sanitizeCSSValue(value: string): string {
  return value.replace(/[{}]/g, "").replace(/<\/style>/gi, "");
}
