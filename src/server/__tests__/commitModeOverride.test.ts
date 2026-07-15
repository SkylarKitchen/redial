/**
 * Mode-override file-save coverage (issue #53, second half) — closes the
 * clipboard-only gap for theme-mode CSS-variable overrides.
 *
 * A mode override is a `--var` edit recorded under a mode's defining selector
 * (`.dark`, `:root.dark`, `[data-theme="ocean"]`, `:root`) — see CONTEXT.md
 * "Mode override". Media-wrapped modes (`prefers-color-scheme`) are read-only
 * in the UI and can never reach the store, so they are out of contract here.
 *
 * These tests pin the server half: a change carrying `modeSelector` is written
 * INSIDE the top-level rule block whose selector matches —
 *  - declaration replaced when the mode block already declares the var
 *    (exact `from` match AND broad rewrite when the authored representation
 *    differs), leaving a same-named declaration in OTHER blocks (`:root`,
 *    sibling modes) untouched;
 *  - declaration inserted when the mode block exists but lacks the var
 *    (`from: ""` — custom props are exempt from the zero-width guard);
 *  - selector matching tolerates whitespace variants and unquoted attribute
 *    values (CSSOM normalizes `[data-theme=ocean]` to quoted form; authored
 *    files often aren't);
 *  - find-or-REFUSE: no matching selector block in the resolved file is a
 *    per-item failure (client falls back to the clipboard side-channel) and
 *    the file is left byte-identical — never a write to a wrong block, never
 *    a newly created block.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleCommit, type CommitChange } from "../commit";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-mode-commit-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeFixture(relativePath: string, content: string): Promise<void> {
  const fullPath = join(tempDir, relativePath);
  await mkdir(fullPath.substring(0, fullPath.lastIndexOf("/")), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
}

async function readFixture(relativePath: string): Promise<string> {
  return readFile(join(tempDir, relativePath), "utf-8");
}

const modeChange = (over: Partial<CommitChange> = {}): CommitChange => ({
  prop: "--surface-page",
  from: "var(--color-neutral-900)",
  to: "var(--color-neutral-800)",
  sourceFile: "src/tokens/semantic.css",
  modeSelector: ".dark",
  ...over,
});

// A trimmed mirror of the test-app's real token file: the same var defined in
// the base block and a mode block.
const TOKENS = [
  ":root {",
  "  --surface-page: var(--color-neutral-50);",
  "  --text-primary: var(--color-neutral-900);",
  "}",
  "",
  ".dark {",
  "  --surface-page: var(--color-neutral-900);",
  "  --text-primary: var(--color-neutral-50);",
  "}",
  "",
].join("\n");

// ---------------------------------------------------------------------------
// Replace inside an existing mode block
// ---------------------------------------------------------------------------

describe("replace inside an existing mode block", () => {
  it("replaces the declaration in the mode block, leaving :root's same-named var untouched", async () => {
    const file = "src/tokens/semantic.css";
    await writeFixture(file, TOKENS);

    const result = await handleCommit([modeChange()], tempDir);

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(file);
    expect(await readFixture(file)).toBe(
      [
        ":root {",
        "  --surface-page: var(--color-neutral-50);", // base untouched
        "  --text-primary: var(--color-neutral-900);",
        "}",
        "",
        ".dark {",
        "  --surface-page: var(--color-neutral-800);",
        "  --text-primary: var(--color-neutral-50);",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("targets only the named mode when a sibling mode declares the same var with the SAME value", async () => {
    const file = "src/tokens/semantic.css";
    // Identical (prop, value) in both blocks: only selector targeting can
    // disambiguate — value uniqueness can't.
    await writeFixture(file, [
      ".light {",
      "  --accent: navy;",
      "}",
      "",
      ".dark {",
      "  --accent: navy;",
      "}",
      "",
    ].join("\n"));

    const result = await handleCommit(
      [modeChange({ prop: "--accent", from: "navy", to: "teal" })],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    expect(await readFixture(file)).toBe(
      [
        ".light {",
        "  --accent: navy;", // sibling mode untouched
        "}",
        "",
        ".dark {",
        "  --accent: teal;",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("rewrites via broad match confined to the mode block when the authored representation differs from `from`", async () => {
    const file = "src/tokens/semantic.css";
    // :root is the decoy: it declares the same prop EARLIER in the file, so an
    // unconfined broad rewrite would hit it first.
    await writeFixture(file, [
      ":root {",
      "  --surface-page: #fafafa;",
      "}",
      "",
      ".dark {",
      "  --surface-page: #171717;", // authored hex; client sent the var() form
      "}",
      "",
    ].join("\n"));

    const result = await handleCommit([modeChange()], tempDir);

    expect(result.failed).toHaveLength(0);
    expect(await readFixture(file)).toBe(
      [
        ":root {",
        "  --surface-page: #fafafa;", // decoy untouched
        "}",
        "",
        ".dark {",
        "  --surface-page: var(--color-neutral-800);",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("writes into a compound `:root.dark` mode block", async () => {
    const file = "src/tokens/semantic.css";
    await writeFixture(file, [
      ":root {",
      "  --accent: blue;",
      "}",
      "",
      ":root.dark {",
      "  --accent: navy;",
      "}",
      "",
    ].join("\n"));

    const result = await handleCommit(
      [
        modeChange({
          prop: "--accent",
          from: "navy",
          to: "teal",
          modeSelector: ":root.dark",
        }),
      ],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    expect(await readFixture(file)).toBe(
      [
        ":root {",
        "  --accent: blue;",
        "}",
        "",
        ":root.dark {",
        "  --accent: teal;",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("matches a data-attribute mode authored without quotes (CSSOM reports it quoted)", async () => {
    const file = "src/tokens/semantic.css";
    // Two data-theme blocks with identical (prop, value); the wrong one comes
    // first, so only quote-tolerant SELECTOR matching finds the right block.
    await writeFixture(file, [
      "[data-theme=forest] {",
      "  --accent: teal;",
      "}",
      "",
      "[data-theme=ocean] {",
      "  --accent: teal;",
      "}",
      "",
    ].join("\n"));

    const result = await handleCommit(
      [
        modeChange({
          prop: "--accent",
          from: "teal",
          to: "aqua",
          modeSelector: '[data-theme="ocean"]',
        }),
      ],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    expect(await readFixture(file)).toBe(
      [
        "[data-theme=forest] {",
        "  --accent: teal;", // wrong-theme decoy untouched
        "}",
        "",
        "[data-theme=ocean] {",
        "  --accent: aqua;",
        "}",
        "",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// Insert when the mode block lacks the declaration
// ---------------------------------------------------------------------------

describe("insert into an existing mode block", () => {
  it("inserts the declaration when the mode block exists but doesn't declare the var", async () => {
    const file = "src/tokens/semantic.css";
    await writeFixture(file, [
      ".dark {",
      "  --text-primary: var(--color-neutral-50);",
      "}",
      "",
    ].join("\n"));

    // Fresh override on a var the mode never declared: `from` is empty by
    // contract (unset in this block), which custom props are allowed.
    const result = await handleCommit([modeChange({ from: "" })], tempDir);

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toContain("--surface-page: var(--color-neutral-800);");
    // Inserted INSIDE the .dark block, not appended after it.
    expect(content.indexOf("--surface-page")).toBeLessThan(content.indexOf("}"));
  });
});

// ---------------------------------------------------------------------------
// Find-or-refuse
// ---------------------------------------------------------------------------

describe("refusal when the mode block can't be found", () => {
  it("fails per-item and leaves the file byte-identical when no block matches the selector", async () => {
    const file = "src/tokens/semantic.css";
    const original = [
      ":root {",
      "  --surface-page: var(--color-neutral-50);",
      "}",
      "",
    ].join("\n");
    await writeFixture(file, original);

    const result = await handleCommit(
      [modeChange({ modeSelector: ".dark" })],
      tempDir,
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/mode/i);
    expect(result.written).toHaveLength(0);
    expect(await readFixture(file)).toBe(original);
  });

  it("never writes the var into a DIFFERENT block as a fallback", async () => {
    const file = "src/tokens/semantic.css";
    // :root declares the var with exactly the `from` value — the tempting
    // wrong target for a `.dark`-scoped change when `.dark` is absent.
    const original = [
      ":root {",
      "  --surface-page: var(--color-neutral-900);",
      "}",
      "",
    ].join("\n");
    await writeFixture(file, original);

    const result = await handleCommit([modeChange()], tempDir);

    expect(result.failed).toHaveLength(1);
    expect(await readFixture(file)).toBe(original);
  });
});
