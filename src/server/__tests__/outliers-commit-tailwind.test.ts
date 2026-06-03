import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  mergeClasses,
  getUtilityGroup,
  findClassNameAttribute,
  handleTailwindCommit,
} from "../commitTailwind";

// ─────────────────────────────────────────────────────────────────────
// Outlier coverage for commitTailwind.ts class rewriting.
//
// These probe weird-but-plausible Tailwind/JSX inputs the panel might
// actually emit or encounter in user source: arbitrary values, important
// modifiers, fractional utilities, stacked variants, interpolated template
// literals, nested cn() calls, and pre-existing intra-string conflicts.
//
// GREEN  = already handled correctly (kept as it()).
// it.fails = genuine bug, documented + locked (body must truly fail).
// ─────────────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-tw-outlier-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeFixture(
  relativePath: string,
  content: string
): Promise<string> {
  const fullPath = join(tempDir, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return fullPath;
}

// ─── getUtilityGroup: arbitrary values & exotic syntax ────────────────

describe("getUtilityGroup — arbitrary & exotic", () => {
  it("treats an arbitrary value width as the w group", () => {
    // w-[37px] should still be a width utility so it replaces w-4 etc.
    expect(getUtilityGroup("w-[37px]")).toBe("w");
  });

  it("treats arbitrary background color as the bg group", () => {
    expect(getUtilityGroup("bg-[#abc]")).toBe("bg");
  });

  it("treats arbitrary grid template as the grid-cols group", () => {
    expect(getUtilityGroup("grid-cols-[1fr_2fr]")).toBe("grid-cols");
  });

  it("treats fractional width w-1/2 as the w group", () => {
    // w-1/2 and w-full both set width; they must share a group to conflict.
    expect(getUtilityGroup("w-1/2")).toBe("w");
  });

  // BUG: getUtilityGroup only recognizes a SINGLE leading variant via its
  // regex; with a stacked variant like "dark:md:hover:bg-x" the prefix it
  // captures is only "dark:", so the remaining "md:hover:bg-x" is treated
  // as a bare class. The dash-index logic then finds first segment "md"
  // which is NOT a known prefix, so the whole thing becomes its own group
  // ("dark:md:hover:bg-x") instead of "dark:md:hover:bg". Two stacked-variant
  // bg utilities that should conflict will never be deduped.
  it("groups a stacked-variant utility by its real prefix", () => {
    expect(getUtilityGroup("dark:md:hover:bg-red-500")).toBe(
      "dark:md:hover:bg"
    );
  });

  // BUG: The important modifier "!" is not stripped before prefix matching.
  // "!mt-2" -> isNeg false -> dashIdx finds "!mt" as first segment, which is
  // not in SINGLE_SEGMENT_PREFIXES, so it falls through to "!mt-2" as its own
  // group. So "!mt-2" and "mt-4" do NOT conflict even though both set margin-top.
  it("groups an important-prefixed utility (!mt-2) under mt", () => {
    expect(getUtilityGroup("!mt-2")).toBe("mt");
  });

  // Tailwind v4 trailing-important syntax "mt-2!" — the "!" lands in the VALUE
  // portion, not the prefix. "mt" is a known multi-segment prefix and "mt-2!"
  // starts with "mt-", so the group is correctly "mt". GREEN — regression lock
  // for the trailing-! form (contrast with the leading-! "!mt-2" bug below).
  it("groups trailing-important utility (mt-2!) under mt", () => {
    expect(getUtilityGroup("mt-2!")).toBe("mt");
  });

  // BUG: Arbitrary VARIANT selectors like "[&>svg]:hidden" have a colon but
  // the leading "[&>svg]:" is not in the known-prefix regex. The class is
  // treated bare; "[&>svg]:hidden" — unsigned starts with "[", DISPLAY_CLASSES
  // does not contain "[&>svg]:hidden", dashIdx is -1 (no dash before bracket
  // content actually there's none), so it returns the whole string as group.
  // Two arbitrary-variant display utils that should conflict won't.
  it(
    "groups arbitrary-variant display utilities so they conflict",
    () => {
      // Both target display under the same arbitrary variant; should share group.
      expect(getUtilityGroup("[&>svg]:flex")).toBe(
        getUtilityGroup("[&>svg]:hidden")
      );
    }
  );
});

// ─── mergeClasses: arbitrary values, important, fractions ─────────────

describe("mergeClasses — exotic value conflict resolution", () => {
  it("replaces w-4 with an arbitrary-value width w-[37px]", () => {
    expect(mergeClasses("w-4 h-8", "w-[37px]")).toBe("h-8 w-[37px]");
  });

  it("replaces an arbitrary bg color with a palette bg color", () => {
    expect(mergeClasses("bg-[#abc] text-white", "bg-red-500")).toBe(
      "text-white bg-red-500"
    );
  });

  it("replaces fractional width w-1/2 with w-full", () => {
    expect(mergeClasses("w-1/2 h-8", "w-full")).toBe("h-8 w-full");
  });

  // BUG: When the EXISTING string already contains two same-group classes
  // (p-2 AND p-4 — a real-world hand-written conflict), mergeClasses only
  // filters existing classes that conflict with the NEW set. Adding p-6
  // removes both p-2 and p-4 (good). But adding a NON-padding class leaves
  // BOTH p-2 and p-4 in place — the function never dedups pre-existing
  // intra-string conflicts. This test asserts the (arguably) desired
  // dedup-on-touch behavior and currently fails.
  it.fails(
    "collapses a pre-existing p-2/p-4 conflict to the last one when other classes are merged",
    () => {
      // Existing has BOTH p-2 and p-4; we add an unrelated class.
      // Desired: keep only the last padding (p-4), append the new class.
      expect(mergeClasses("p-2 p-4 flex", "items-center")).toBe(
        "p-4 flex items-center"
      );
    }
  );

  it("when the new set conflicts, all duplicate existing group members are removed", () => {
    // Adding p-6 should remove BOTH pre-existing paddings.
    expect(mergeClasses("p-2 p-4 flex", "p-6")).toBe("flex p-6");
  });

  // BUG: An important-prefixed new class "!mt-2" gets group "!mt-2" (own
  // group, see getUtilityGroup bug), so it does NOT replace an existing
  // plain "mt-4" — both end up in the output. Desired: !mt-2 replaces mt-4
  // (same margin-top property; !important just raises specificity).
  it("important-prefixed margin replaces plain margin", () => {
    expect(mergeClasses("mt-4 flex", "!mt-2")).toBe("flex !mt-2");
  });

  it("idempotent merge: re-adding the identical class does not duplicate it", () => {
    // Adding w-6 when w-6 is already present should leave a single w-6.
    expect(mergeClasses("flex w-6", "w-6")).toBe("flex w-6");
  });

  it("collapses internal whitespace (tabs / double spaces) between classes", () => {
    // Source classNames can carry odd whitespace; split(/\s+/) should normalize.
    expect(mergeClasses("flex\t\titems-center  p-2", "p-4")).toBe(
      "flex items-center p-4"
    );
  });
});

// ─── parseClassNameOnLine via findClassNameAttribute / commit ─────────

describe("template literal & cn() parsing edge cases", () => {
  // BUG: Template-literal parsing uses /className=\{`([^`]*)`\}/ which stops
  // at the FIRST closing backtick. With an interpolation `${x}` there is no
  // backtick inside, so it still matches but captures across the ${...},
  // and the rewrite would clobber the interpolation. More importantly, the
  // captured "classes" include the literal `${x}` token, which is then fed to
  // mergeClasses as if it were a utility. Here we assert the parser refuses to
  // treat an interpolated template as a plain editable string (returns null)
  // — it does NOT, so this fails.
  it(
    "does not parse an interpolated template literal as a plain class string",
    () => {
      const lines = [
        "function C(){",
        "  return <div className={`flex ${dynamic} p-4`}>x</div>;",
        "}",
      ];
      const m = findClassNameAttribute(lines);
      // Editing here is unsafe (would mangle the interpolation), so the
      // parser ought to decline. Desired: null.
      expect(m).toBeNull();
    }
  );

  // BUG: The cn() regex /className=\{(?:cn|clsx)\(([^)]*)\)\}/ uses [^)] so it
  // stops at the FIRST ')'. A nested call like cn("flex p-2", active && toggle(x))
  // means the regex needs ")}" right after the first ")", but the source has
  // "))}" — the inner ")" breaks the anchor and the WHOLE pattern fails to
  // match. So a perfectly valid className with a nested call inside cn() is not
  // detected at all (returns null), and any edit to that element silently fails.
  it(
    "locates first literal in cn() even with a nested call inside",
    () => {
      const lines = [
        "function C(){",
        '  return <button className={cn("flex p-2", active && toggle(x))}>x</button>;',
        "}",
      ];
      const m = findClassNameAttribute(lines);
      expect(m).not.toBeNull();
      expect(m!.isCnWrapper).toBe(true);
      expect(lines[m!.lineIdx].slice(m!.start, m!.end)).toBe("flex p-2");
    }
  );

  // BUG: When cn()'s FIRST argument is a variable and the literal is the
  // SECOND argument (cn(base, "flex p-2")), the regex grabs the first string
  // literal anywhere in the args — so it still finds "flex p-2". Verify the
  // captured slice is exactly the literal, not the variable.
  it("captures the literal even when it's the second cn() argument", () => {
    const lines = [
      "function C(){",
      '  return <button className={cn(base, "flex p-2")}>x</button>;',
      "}",
    ];
    const m = findClassNameAttribute(lines);
    expect(m).not.toBeNull();
    expect(lines[m!.lineIdx].slice(m!.start, m!.end)).toBe("flex p-2");
  });

  // Two className-bearing attributes on a SINGLE physical line. parseClassNameOnLine
  // intentionally matches only the FIRST per line. Assert the documented
  // single-match-per-line behavior (the first wins).
  it("two classNames on one line: only the first is located", () => {
    const lines = [
      '<><a className="text-sm">A</a><b className="text-lg">B</b></>',
    ];
    const m = findClassNameAttribute(lines);
    expect(m).not.toBeNull();
    expect(lines[m!.lineIdx].slice(m!.start, m!.end)).toBe("text-sm");
  });
});

// ─── handleTailwindCommit: full round-trip exotic cases ───────────────

describe("handleTailwindCommit — exotic round trips", () => {
  it("writes an arbitrary-value width back into source, replacing w-4", async () => {
    const filePath = "src/Arb.tsx";
    await writeFixture(
      filePath,
      [
        "export default function Arb() {",
        '  return <div className="flex w-4">x</div>;',
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 2,
          existingClasses: "flex w-4",
          newClasses: "w-[37px]",
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("flex w-[37px]");
    expect(content).not.toMatch(/\bw-4\b/);
  });

  // BUG: existingClasses contains arbitrary value with a space-equivalent
  // underscore grid template. findClassNameForChange compares the exact
  // slice; if the panel sends grid-cols-[1fr_2fr] but the file literally has
  // that, exact match works. We verify the underscore syntax round-trips and
  // the new grid template replaces the old one.
  it("replaces an arbitrary grid-cols template in source", async () => {
    const filePath = "src/Grid.tsx";
    await writeFixture(
      filePath,
      [
        "export default function Grid() {",
        '  return <div className="grid grid-cols-[1fr_2fr] gap-4">x</div>;',
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 2,
          existingClasses: "grid grid-cols-[1fr_2fr] gap-4",
          newClasses: "grid-cols-[1fr_1fr_1fr]",
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("grid-cols-[1fr_1fr_1fr]");
    expect(content).not.toContain("grid-cols-[1fr_2fr]");
  });

  // BUG: regex-special characters in existingClasses. findClassNameForChange
  // does an exact STRING slice comparison (not regex) so brackets/parens in
  // the class should be safe. Verify a className containing regex-meta chars
  // (arbitrary value with parens like bg-[url(https://x.test/x.png)]) round-trips.
  it("handles a className containing regex-special chars (url arbitrary value)", async () => {
    const filePath = "src/Url.tsx";
    const cls = "bg-[url(https://x.test/x.png)] flex";
    await writeFixture(
      filePath,
      [
        "export default function Url() {",
        `  return <div className="${cls}">x</div>;`,
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 2,
          existingClasses: cls,
          newClasses: "p-4",
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("bg-[url(https://x.test/x.png)] flex p-4");
  });

  // BUG: A className whose existing string is the EMPTY string ("") on a real
  // element <div className="">. existingClasses "" makes findClassNameForChange
  // fall through to "any className" candidate list (legacy path). With a single
  // empty-class element it should still write. We assert new classes are added
  // into the empty attribute.
  it("adds classes into an empty className attribute", async () => {
    const filePath = "src/Empty.tsx";
    await writeFixture(
      filePath,
      [
        "export default function Empty() {",
        '  return <div className="">x</div>;',
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 2,
          existingClasses: "",
          newClasses: "flex p-4",
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain('className="flex p-4"');
  });

  // BUG: When two changes target the SAME className string in one commit but
  // the second change's existingClasses no longer matches the file (because the
  // first change already rewrote that line), the second change falls back to the
  // legacy near-line search. With a UNIQUE className this still resolves; verify
  // both edits land (sequential merge within one file).
  it("applies two sequential changes to the same element in one commit", async () => {
    const filePath = "src/Seq.tsx";
    await writeFixture(
      filePath,
      [
        "export default function Seq() {",
        '  return <div className="flex w-4">x</div>;',
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 2,
          existingClasses: "flex w-4",
          newClasses: "w-6",
        },
        {
          sourceFile: filePath,
          sourceLine: 2,
          // After change #1 the line now reads "flex w-6"; this stale value
          // won't exact-match, so the legacy near-line fallback kicks in.
          existingClasses: "flex w-4",
          newClasses: "p-4",
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    // Both edits should be present and w-4 fully gone.
    expect(content).toContain("w-6");
    expect(content).toContain("p-4");
    expect(content).not.toMatch(/\bw-4\b/);
  });

  // BUG: important-prefixed NEW class fails to replace the existing plain
  // utility at the file level (mirrors the unit-level !mt bug). Asserts the
  // desired source outcome: mt-4 removed, !mt-2 present.
  it(
    "important-prefixed new class replaces plain utility in source",
    async () => {
      const filePath = "src/Imp.tsx";
      await writeFixture(
        filePath,
        [
          "export default function Imp() {",
          '  return <div className="mt-4 flex">x</div>;',
          "}",
        ].join("\n")
      );

      const result = await handleTailwindCommit(
        [
          {
            sourceFile: filePath,
            sourceLine: 2,
            existingClasses: "mt-4 flex",
            newClasses: "!mt-2",
          },
        ],
        tempDir
      );

      expect(result.failed).toHaveLength(0);
      const content = await readFile(join(tempDir, filePath), "utf-8");
      expect(content).toContain("!mt-2");
      expect(content).not.toMatch(/\bmt-4\b/);
    }
  );
});
