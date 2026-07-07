/**
 * cssMask.ts — comment / string / url() masking for CSS text.
 *
 * Structural split out of commit.ts (issue #138): every line-selection,
 * declaration match and brace count in the save path runs on the MASKED view
 * produced here, while the actual text replacement is applied to the ORIGINAL
 * lines. The mask is same-length and line-for-line, so indices map 1:1.
 *
 * Also the shared home of escapeRegex (previously duplicated across the
 * server modules).
 */

/** Escape a literal string for embedding inside a RegExp source. */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Return a SAME-LENGTH copy of `source` with the INTERIORS of CSS comments,
 * string literals ('...' / "...") and url(...) contents replaced by spaces.
 * Newlines and the overall char/line count are preserved, so line indices and
 * column offsets computed on the mask map 1:1 back onto the original text.
 *
 * Used for ALL line-selection and brace-counting so that:
 *   - a comment that mentions `color: blue` is never mistaken for a declaration,
 *   - a `{` / `}` / `;` / prop name living inside a string or url() can't fool
 *     the brace-depth counter or the declaration matcher.
 * The actual text replacement is always applied to the ORIGINAL line.
 */
export function maskCSS(source: string): string {
  const out = source.split("");
  const n = source.length;
  let i = 0;
  while (i < n) {
    const ch = source[i];
    const next = i + 1 < n ? source[i + 1] : "";

    // Block comment — mask the interior, keep the delimiters.
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) i += 2; // skip the closing "*/"
      continue;
    }

    // String literal — mask the interior, keep the quotes.
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\" && i + 1 < n) {
          // escaped char — mask both, preserving newline positions
          if (source[i] !== "\n") out[i] = " ";
          if (source[i + 1] !== "\n") out[i + 1] = " ";
          i += 2;
          continue;
        }
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) i++; // keep the closing quote
      continue;
    }

    // url(...) — mask the (possibly brace-bearing) body. A quoted url body is
    // handled by the string branch above, so bail to it when one is found.
    if (
      (ch === "u" || ch === "U") &&
      /^url\s*\(/i.test(source.slice(i, i + 6))
    ) {
      let j = i + 3;
      while (j < n && /\s/.test(source[j])) j++;
      if (source[j] === "(") {
        i = j + 1; // keep "url("
        while (i < n && source[i] !== ")") {
          if (source[i] === "'" || source[i] === '"') break;
          if (source[i] !== "\n") out[i] = " ";
          i++;
        }
        continue;
      }
    }

    i++;
  }
  return out.join("");
}

/** Build the masked, line-split view used for all matching/brace-counting. */
export function maskedLinesOf(lines: string[]): string[] {
  return maskCSS(lines.join("\n")).split("\n");
}
