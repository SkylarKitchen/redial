/**
 * cssImport.ts — Parse CSS text from clipboard for bulk property application
 */

export interface CSSDeclaration {
  prop: string;
  value: string;
}

export function parseCSSText(text: string): CSSDeclaration[] {
  const results: CSSDeclaration[] = [];

  // Strip CSS comments
  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, "");

  // Strip selectors and braces (handle both ".class { ... }" and bare declarations)
  const cleaned = noComments.replace(/[^{]*\{/g, "").replace(/\}/g, "");

  // Split by semicolons
  const declarations = cleaned
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(":");
    if (colonIdx === -1) continue;

    const prop = decl.slice(0, colonIdx).trim();
    const value = decl.slice(colonIdx + 1).trim();

    // Validate: prop must be a valid CSS property name (lowercase letters, hyphens, starts with letter or --)
    if (!prop || !value) continue;
    if (!/^-?-?[a-z][a-z0-9-]*$/i.test(prop)) continue;

    results.push({ prop, value });
  }

  return results;
}
