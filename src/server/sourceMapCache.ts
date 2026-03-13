/**
 * sourceMapCache.ts — Parse CSS source maps for accurate file + line resolution
 *
 * Uses @jridgewell/trace-mapping (transitive dep of Next.js) to read .map files
 * adjacent to compiled CSS in .next/static/css/.
 *
 * LRU cache (max 50 entries) prevents re-parsing on repeated saves.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";

// --- LRU Cache ---

const MAX_CACHE = 50;

/** Ordered map: most-recently-used entries are at the end. */
const cache = new Map<string, TraceMap>();

function lruGet(key: string): TraceMap | undefined {
  const val = cache.get(key);
  if (val !== undefined) {
    // Move to end (most-recently-used)
    cache.delete(key);
    cache.set(key, val);
  }
  return val;
}

function lruSet(key: string, val: TraceMap): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CACHE) {
    // Evict oldest (first) entry
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, val);
}

/** Exposed for testing — clears the internal LRU cache. */
export function clearCache(): void {
  cache.clear();
}

/** Exposed for testing — returns current cache size. */
export function cacheSize(): number {
  return cache.size;
}

// --- Public API ---

/**
 * Load and parse a source map adjacent to a compiled CSS file.
 * Returns the parsed TraceMap, or null if not found / unparseable.
 */
export function getSourceMap(
  compiledCssPath: string,
  _projectRoot: string,
): TraceMap | null {
  const cached = lruGet(compiledCssPath);
  if (cached) return cached;

  const mapPath = compiledCssPath + ".map";
  if (!existsSync(mapPath)) return null;

  try {
    const raw = readFileSync(mapPath, "utf-8");
    const parsed = JSON.parse(raw);
    const map = new TraceMap(parsed);
    lruSet(compiledCssPath, map);
    return map;
  } catch {
    // Malformed map file — skip
    return null;
  }
}

/**
 * Attempt to resolve a source file + line using CSS source maps.
 *
 * @param cssHref  The compiled CSS href (e.g., "/_next/static/css/abc123.css")
 * @param line     1-based line in the compiled CSS
 * @param column   0-based column in the compiled CSS
 * @param projectRoot  Absolute path to the project root
 * @returns { file, line } or null
 */
export function trySourceMapResolution(
  cssHref: string | undefined,
  line: number,
  column: number,
  projectRoot: string,
): { file: string; line: number } | null {
  if (!cssHref) return null;

  // Convert href to filesystem path
  // e.g., "/_next/static/css/abc123.css" → "<projectRoot>/.next/static/css/abc123.css"
  // or "http://localhost:3000/_next/static/css/abc123.css"
  let pathname: string;
  try {
    pathname = new URL(cssHref, "http://localhost").pathname;
  } catch {
    pathname = cssHref;
  }

  // Strip /_next/ prefix and resolve relative to .next/ in projectRoot
  const nextRelative = pathname.replace(/^\/_next\//, "");
  const compiledCssPath = resolve(join(projectRoot, ".next", nextRelative));

  const map = getSourceMap(compiledCssPath, projectRoot);
  if (!map) return null;

  try {
    const pos = originalPositionFor(map, { line, column });
    if (pos.source == null || pos.line == null) return null;

    // pos.source is relative to the sourceRoot in the map.
    // Resolve it to a project-relative path.
    let file = pos.source;

    // Strip webpack:/// or similar protocol prefixes
    file = file.replace(/^webpack:\/\/\//, "");
    file = file.replace(/^\.\/(\.\/)*/, "");

    return { file, line: pos.line };
  } catch {
    return null;
  }
}
