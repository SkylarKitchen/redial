/**
 * Runtime smoke test for the published npm artifact (issue #93).
 *
 * packaging.test.ts checks the pack manifest statically (sourcemap presence,
 * d.cts typechecking). This file exercises the consumer surface at runtime:
 * it packs the real tarball, installs it into a scratch consumer fixture,
 * and loads every published entry point through node's own module resolution
 * from spawned node processes — so vitest's resolver/aliasing can't cheat.
 *
 * Covered surface (what the README promises):
 *   - every package.json "exports" subpath resolves via import AND require
 *   - `import { Tuner } from "redial"` loads and Tuner is a function
 *   - `"use client"` survives at the top of dist/index.js
 *   - `import { GET, POST } from "redial/server"` — both route handlers
 *   - `redial/styles.css` resolves to a non-empty CSS file
 *   - `require("redial/next-plugin")` is callable, exposes .withTuner, and
 *     wraps a next config without dropping the consumer's own keys
 *
 * Offline by construction: `npm pack` from a scripts-stripped copy (the
 * `prepare` lifecycle runs even under --ignore-scripts — see
 * packaging.test.ts), then the tarball is extracted straight into the
 * fixture's node_modules (equivalent to `npm install <tarball>` for
 * resolution purposes, but with zero registry traffic). Runtime deps the
 * dist bundle imports (react, react-dom, lucide-react, motion) are
 * symlinked from wherever Node resolves them for the repo root — the main
 * checkout's node_modules when running from a session worktree.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRepoDep } from "./resolveRepoDep";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const distBuilt = existsSync(join(repoRoot, "dist", "index.js"));

/** Deps the published bundle imports at module scope (peers + hard deps). */
const RUNTIME_DEPS = ["react", "react-dom", "lucide-react", "motion"];

describe.skipIf(!distBuilt)("published package smoke (issue #93)", () => {
  let packDir: string;
  let fixtureDir: string;
  let installedPkg: { exports?: Record<string, unknown> };

  /**
   * Write a script into the fixture and run it with a bare `node` from the
   * fixture dir, so all module resolution happens exactly the way a consumer
   * app resolves — no vitest, no repo tsconfig paths. The script must print
   * a single JSON object to stdout.
   */
  function runInFixture<T>(filename: string, source: string): T {
    const file = join(fixtureDir, filename);
    writeFileSync(file, source);
    try {
      const out = execFileSync(process.execPath, [file], {
        cwd: fixtureDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return JSON.parse(out) as T;
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      throw new Error(
        `fixture script ${filename} failed:\n${e.stderr ?? ""}${e.stdout ?? ""}${
          e.stderr || e.stdout ? "" : e.message ?? ""
        }`
      );
    }
  }

  beforeAll(() => {
    // 1. Pack the real tarball from a scripts-stripped copy of the repo
    //    (same pattern packaging.test.ts uses, but a real pack, not dry-run).
    packDir = mkdtempSync(join(tmpdir(), "redial-smoke-pack-"));
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8")
    ) as Record<string, unknown> & { files?: string[] };
    delete pkg.scripts;
    writeFileSync(join(packDir, "package.json"), JSON.stringify(pkg, null, 2));
    for (const entry of pkg.files ?? []) {
      const src = join(repoRoot, entry);
      if (existsSync(src)) cpSync(src, join(packDir, entry), { recursive: true });
    }
    const raw = execFileSync("npm", ["pack", "--json"], {
      cwd: packDir,
      encoding: "utf8",
    });
    const packed = JSON.parse(raw.slice(raw.indexOf("["))) as Array<{
      filename: string;
    }>;
    const tarball = join(packDir, packed[0].filename);

    // 2. Scratch consumer fixture with the tarball "installed" offline.
    fixtureDir = mkdtempSync(join(tmpdir(), "redial-smoke-app-"));
    writeFileSync(
      join(fixtureDir, "package.json"),
      JSON.stringify(
        { name: "redial-smoke-fixture", version: "0.0.0", private: true, type: "module" },
        null,
        2
      )
    );
    const nodeModules = join(fixtureDir, "node_modules");
    mkdirSync(nodeModules, { recursive: true });
    const extractDir = join(packDir, "extract");
    mkdirSync(extractDir);
    execFileSync("tar", ["-xzf", tarball, "-C", extractDir]);
    renameSync(join(extractDir, "package"), join(nodeModules, "redial"));

    // 3. Symlink runtime deps, resolved as Node would resolve them from the
    //    repo root, so the ESM bundle can actually evaluate (node resolves
    //    through symlinks to their realpath, so the deps' own transitive
    //    imports keep resolving where they are installed).
    for (const dep of RUNTIME_DEPS) {
      const target = resolveRepoDep(dep);
      if (!target) throw new Error(`missing repo dep: ${dep}`);
      symlinkSync(target, join(nodeModules, dep), "dir");
    }

    installedPkg = JSON.parse(
      readFileSync(join(nodeModules, "redial", "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };
  }, 90_000);

  afterAll(() => {
    if (packDir) rmSync(packDir, { recursive: true, force: true });
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("ships the README-promised entry points in its exports map", () => {
    const subpaths = Object.keys(installedPkg.exports ?? {});
    expect(subpaths).toEqual(
      expect.arrayContaining([".", "./server", "./next-plugin", "./styles.css"])
    );
  });

  it(
    "resolves every exports subpath via import and require from a consumer",
    () => {
      const subpaths = Object.keys(installedPkg.exports ?? {});
      expect(subpaths.length).toBeGreaterThan(0);
      const result = runInFixture<
        Record<string, { importFile: string; requireFile: string; size: number }>
      >(
        "resolve-exports.mjs",
        `
        import { createRequire } from "node:module";
        import { statSync } from "node:fs";
        import { fileURLToPath } from "node:url";
        const require = createRequire(import.meta.url);
        const subpaths = ${JSON.stringify(subpaths)};
        const out = {};
        for (const key of subpaths) {
          const specifier = "redial" + key.slice(1);
          const importFile = fileURLToPath(import.meta.resolve(specifier));
          const requireFile = require.resolve(specifier);
          out[key] = { importFile, requireFile, size: statSync(importFile).size };
        }
        console.log(JSON.stringify(out));
        `
      );
      for (const key of subpaths) {
        expect(result[key], `subpath ${key} did not resolve`).toBeDefined();
        expect(result[key].size, `subpath ${key} resolves to an empty file`).toBeGreaterThan(0);
        // import and require must agree (single "default" condition per subpath).
        expect(result[key].requireFile).toBe(result[key].importFile);
      }
    },
    20_000
  );

  it(
    "main export loads under import() and exposes Tuner",
    () => {
      const result = runInFixture<{ keys: string[]; tunerType: string }>(
        "load-main.mjs",
        `
        const m = await import("redial");
        console.log(JSON.stringify({
          keys: Object.keys(m).sort(),
          tunerType: typeof m.Tuner,
        }));
        `
      );
      expect(result.keys).toContain("Tuner");
      expect(result.tunerType).toBe("function");
    },
    20_000
  );

  it('keeps the "use client" banner at the top of the main bundle', () => {
    const bundle = readFileSync(
      join(fixtureDir, "node_modules", "redial", "dist", "index.js"),
      "utf8"
    );
    const firstLine = bundle.split("\n").find((line) => line.trim() !== "");
    expect(firstLine?.trim()).toMatch(/^["']use client["'];?$/);
  });

  it(
    "redial/server exposes GET and POST route handlers",
    () => {
      const result = runInFixture<{ getType: string; postType: string }>(
        "load-server.mjs",
        `
        const m = await import("redial/server");
        console.log(JSON.stringify({
          getType: typeof m.GET,
          postType: typeof m.POST,
        }));
        `
      );
      expect(result.getType).toBe("function");
      expect(result.postType).toBe("function");
    },
    20_000
  );

  it("redial/styles.css points at a non-empty stylesheet", () => {
    const cssExport = (installedPkg.exports ?? {})["./styles.css"];
    expect(typeof cssExport).toBe("string");
    const cssFile = join(fixtureDir, "node_modules", "redial", cssExport as string);
    expect(existsSync(cssFile), `${cssExport} missing from the installed package`).toBe(true);
    expect(statSync(cssFile).size).toBeGreaterThan(0);
    expect(readFileSync(cssFile, "utf8")).toContain("{");
  });

  it(
    "redial/next-plugin loads under require() and exposes withTuner",
    () => {
      const result = runInFixture<{
        defaultType: string;
        namedType: string;
        sameFn: boolean;
        preservesConfig: boolean;
        webpackHook: string;
      }>(
        "load-plugin.cjs",
        `
        const plugin = require("redial/next-plugin");
        const wrapped = plugin({ reactStrictMode: true });
        console.log(JSON.stringify({
          defaultType: typeof plugin,
          namedType: typeof plugin.withTuner,
          sameFn: plugin === plugin.withTuner,
          preservesConfig: wrapped.reactStrictMode === true,
          webpackHook: typeof wrapped.webpack,
        }));
        `
      );
      expect(result.defaultType).toBe("function");
      expect(result.namedType).toBe("function");
      expect(result.sameFn).toBe(true);
      expect(result.preservesConfig).toBe(true);
      expect(result.webpackHook).toBe("function");
    },
    20_000
  );
});
