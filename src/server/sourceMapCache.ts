/**
 * sourceMapCache.ts — Parse CSS source maps for accurate file + line resolution
 *
 * Uses @jridgewell/trace-mapping (transitive dep of Next.js) to read .map files
 * adjacent to compiled CSS. Webpack dev writes them under .next/static/…;
 * Turbopack dev (the `next dev` default since Next 15) writes them under
 * .next/dev/static/… while still serving from /_next/, emits SECTIONED maps,
 * and anchors sources at `turbopack:///[project]/…` (issue #59) — all three
 * are handled here.
 *
 * LRU cache (max 50 entries) prevents re-parsing on repeated saves.
 */

import { existsSync, readFileSync, statSync } from "fs";
import { resolve, join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import {
  AnyMap,
  LEAST_UPPER_BOUND,
  originalPositionFor,
  type TraceMap,
} from "@jridgewell/trace-mapping";

// --- LRU Cache ---

const MAX_CACHE = 50;

/** Parsed map plus the .map file identity it was parsed from, so an HMR
 *  rebuild that rewrites the file invalidates the entry (issue #68). */
type CacheEntry = { map: TraceMap; mtimeMs: number; size: number };

/** Ordered map: most-recently-used entries are at the end. */
const cache = new Map<string, CacheEntry>();

function lruGet(key: string): CacheEntry | undefined {
  const val = cache.get(key);
  if (val !== undefined) {
    // Move to end (most-recently-used)
    cache.delete(key);
    cache.set(key, val);
  }
  return val;
}

function lruSet(key: string, val: CacheEntry): void {
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
  const mapPath = compiledCssPath + ".map";

  // Validate any cached entry against the .map file's current identity —
  // dev-server rebuilds rewrite maps in place, and serving the stale parse
  // resolves saves into pre-rebuild sources (issue #68). Size is compared
  // alongside mtime so back-to-back rewrites within one mtime tick still
  // invalidate. A missing/unstatable map drops the entry entirely.
  let mtimeMs: number;
  let size: number;
  try {
    const stat = statSync(mapPath);
    mtimeMs = stat.mtimeMs;
    size = stat.size;
  } catch {
    cache.delete(compiledCssPath);
    return null;
  }

  const cached = lruGet(compiledCssPath);
  if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
    return cached.map;
  }

  try {
    const raw = readFileSync(mapPath, "utf-8");
    const parsed = JSON.parse(raw);
    // AnyMap, not TraceMap: Turbopack emits sectioned maps ({ sections: … }),
    // which the TraceMap constructor rejects outright.
    const map = new AnyMap(parsed);
    lruSet(compiledCssPath, { map, mtimeMs, size });
    return map;
  } catch {
    // Malformed map file — drop any stale entry and skip
    cache.delete(compiledCssPath);
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
  const located = loadMapForHref(cssHref, projectRoot);
  if (!located) return null;

  try {
    let pos = originalPositionFor(located.map, { line, column });
    if (pos.source == null) {
      // The default (greatest-lower-bound) lookup only comes up empty when
      // the position sits BEFORE the first mapped segment (e.g. a banner
      // line). Retrying least-upper-bound lands on that first segment.
      pos = originalPositionFor(located.map, { line, column, bias: LEAST_UPPER_BOUND });
    }
    if (pos.source == null || pos.line == null) return null;

    const file = sourceToProjectFile(pos.source, located.compiledCssPath, projectRoot);
    if (file == null) return null;
    return { file, line: pos.line };
  } catch {
    return null;
  }
}

/**
 * Resolve which source FILE a compiled stylesheet comes from, without a
 * position. Position probes can't answer this reliably: Turbopack's sectioned
 * maps leave their banner line uncovered by any section, so probing (1,0)
 * returns nothing. The map's own `sources` list is authoritative — return the
 * first entry that normalizes to a user file.
 */
export function tryFirstMappedSourceFile(
  cssHref: string | undefined,
  projectRoot: string,
): string | null {
  const located = loadMapForHref(cssHref, projectRoot);
  if (!located) return null;
  for (const source of located.map.sources) {
    if (source == null) continue;
    const file = sourceToProjectFile(source, located.compiledCssPath, projectRoot);
    if (file != null) return file;
  }
  return null;
}

/**
 * Convert an /_next/ href to the on-disk compiled CSS path and load its map.
 * Probes both bundler layouts: webpack dev writes static assets to .next/…,
 * Turbopack dev (the `next dev` default since Next 15) to .next/dev/… — the
 * classic path does not exist there at all.
 */
function loadMapForHref(
  cssHref: string | undefined,
  projectRoot: string,
): { map: TraceMap; compiledCssPath: string } | null {
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

  const nextRelative = pathname.replace(/^\/_next\//, "");
  for (const candidate of [
    resolve(join(projectRoot, ".next", nextRelative)),
    resolve(join(projectRoot, ".next", "dev", nextRelative)),
  ]) {
    const map = getSourceMap(candidate, projectRoot);
    if (map) return { map, compiledCssPath: candidate };
  }
  return null;
}

/**
 * Normalize a raw source-map `sources` entry to a projectRoot-relative file
 * path, or null when the entry is a bundler internal rather than user source.
 * The commit caller re-checks root containment before writing, so this only
 * has to locate the file, not police it.
 */
function sourceToProjectFile(
  rawSource: string,
  compiledCssPath: string,
  projectRoot: string,
): string | null {
  // Strip bundler protocol prefixes. Turbopack stacks its scheme, and the
  // trace-mapping section join collapses the inner one to a single slash
  // ("turbopack:///turbopack:/[project]/…"), so accept 1–3 slashes and
  // strip repeatedly.
  let source = rawSource.replace(/^(?:webpack:\/\/\/|turbopack:\/{1,3})+/, "");

  // Turbopack also emits absolute file: URLs (e.g. the app's own globals.css).
  if (source.startsWith("file:")) {
    try {
      return relative(projectRoot, fileURLToPath(new URL(source)));
    } catch {
      return null;
    }
  }

  if (source.startsWith("[project]/")) {
    // Turbopack anchors sources at its root — the nearest workspace root,
    // which can be an ANCESTOR of the Next.js project (monorepo / nested
    // app). Probe upward from projectRoot for the first anchor where the
    // file exists.
    const rest = source.slice("[project]/".length);
    let anchor = projectRoot;
    for (let up = 0; up <= 3; up++) {
      const candidate = resolve(anchor, rest);
      if (existsSync(candidate)) return relative(projectRoot, candidate);
      anchor = dirname(anchor);
    }
    return null;
  }
  // Other bracket-tagged origins ([next]/internal fonts etc.) are bundler
  // internals, not user source files.
  if (source.startsWith("[")) return null;

  source = source.replace(/^\.\/(\.\/)*/, "");

  // Resolve source relative to the .map file's directory, then make it
  // relative to projectRoot so the caller can resolve(projectRoot, file).
  const mapDir = dirname(compiledCssPath);
  return relative(projectRoot, resolve(mapDir, source));
}
