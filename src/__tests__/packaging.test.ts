/**
 * Packaging invariants for the published npm artifact.
 *
 * #88 — next-plugin.d.cts must typecheck for consumers with skipLibCheck: false.
 *        (TS2309: `export =` cannot coexist with other exports.)
 * #90 — every sourceMappingURL referenced by a packed file must itself be
 *        included in the pack list (no dangling map references for consumers).
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tscBin = join(repoRoot, "node_modules", "typescript", "bin", "tsc");

/** Run tsc, returning combined output (tsc exits non-zero on any error). */
function runTsc(args: string[]): string {
  try {
    return execFileSync(process.execPath, [tscBin, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
}

describe("next-plugin.d.cts (issue #88)", () => {
  it("typechecks for consumers with skipLibCheck: false", () => {
    // The consumer fixture must live under the repo so `import type { … }
    // from "next"` resolves through the repo's node_modules chain.
    const cacheDir = join(repoRoot, "node_modules", ".cache");
    mkdirSync(cacheDir, { recursive: true });
    const tmp = mkdtempSync(join(cacheDir, "redial-dcts-"));
    try {
      // A consumer-shaped usage: default (export =) and named property,
      // matching the runtime shape of next-plugin.cjs.
      const consumer = join(tmp, "consumer.cts");
      writeFileSync(
        consumer,
        [
          `import type { NextConfig } from "next";`,
          `import withTuner = require(${JSON.stringify(
            join(repoRoot, "next-plugin.cjs")
          )});`,
          ``,
          `export const viaDefault: NextConfig = withTuner({ reactStrictMode: true });`,
          `export const viaNamed: NextConfig = withTuner.withTuner({});`,
          ``,
        ].join("\n")
      );

      const output = runTsc([
        "--noEmit",
        "--skipLibCheck",
        "false",
        "--strict",
        "--esModuleInterop",
        "--module",
        "commonjs",
        "--moduleResolution",
        "node",
        "--target",
        "es2020",
        join(repoRoot, "next-plugin.d.cts"),
        consumer,
      ]);

      // With skipLibCheck off, tsc also surfaces errors inside next's own
      // bundled types — those are next's problem, not ours. The invariant is
      // that no error points at OUR declaration file or the consumer usage.
      const ownErrors = output
        .split("\n")
        .filter(
          (line) =>
            /error TS\d+/.test(line) &&
            (line.includes("next-plugin.d.cts") || line.includes("consumer.cts"))
        );
      expect(ownErrors, `tsc errors in redial's published types:\n${ownErrors.join("\n")}`).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("published source maps (issue #90)", () => {
  const distBuilt = existsSync(join(repoRoot, "dist", "index.js"));

  it("does not exclude dist source maps from the files allowlist", () => {
    // Static guard that runs even when dist/ hasn't been built (CI runs
    // tests before build): tsup emits sourcemap references into dist, so
    // the package must not carve the .map files back out.
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8")
    ) as { files?: string[] };
    const mapExclusions = (pkg.files ?? []).filter(
      (entry) => entry.startsWith("!") && entry.includes(".map")
    );
    expect(mapExclusions).toEqual([]);
  });

  it.skipIf(!distBuilt)(
    "packs every source map referenced by a packed file",
    () => {
      // Pack from a temp copy with lifecycle scripts stripped: `npm pack`
      // runs `prepare` (a full tsup rebuild) even under --ignore-scripts,
      // which is slow and clobbers dist/ mid-test-run.
      const tmp = mkdtempSync(join(tmpdir(), "redial-pack-"));
      try {
        const pkg = JSON.parse(
          readFileSync(join(repoRoot, "package.json"), "utf8")
        ) as Record<string, unknown> & { files?: string[] };
        delete pkg.scripts;
        writeFileSync(join(tmp, "package.json"), JSON.stringify(pkg, null, 2));
        for (const entry of ["dist", "next-plugin.cjs", "next-plugin.d.cts", "LICENSE", "README.md"]) {
          const src = join(repoRoot, entry);
          if (existsSync(src)) cpSync(src, join(tmp, entry), { recursive: true });
        }

        const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
          cwd: tmp,
          encoding: "utf8",
        });
        const parsed = JSON.parse(raw.slice(raw.indexOf("["))) as Array<{
          files: Array<{ path: string }>;
        }>;
        const packed = new Set(parsed[0].files.map((f) => f.path));

        const dangling: string[] = [];
        let referencesSeen = 0;
        for (const path of packed) {
          if (!/\.(js|cjs|mjs|css)$/.test(path)) continue;
          const content = readFileSync(join(tmp, path), "utf8");
          for (const match of content.matchAll(
            /[#@] sourceMappingURL=([^\s*]+)/g
          )) {
            referencesSeen += 1;
            const mapPath = posix.join(posix.dirname(path), match[1]);
            if (!packed.has(mapPath)) {
              dangling.push(`${path} -> ${match[1]}`);
            }
          }
        }

        expect(dangling, `packed files reference maps missing from the package:\n${dangling.join("\n")}`).toEqual([]);
        // Sanity: if tsup ever stops emitting references entirely, that is
        // also a valid green state — but with sourcemap enabled we expect
        // references to exist, so flag a silently-empty scan.
        expect(referencesSeen).toBeGreaterThan(0);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    }
  );
});
