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

// --- Test helpers ---

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-tw-test-"));
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

// --- getUtilityGroup ---

describe("getUtilityGroup", () => {
  it("extracts prefix from value utilities", () => {
    expect(getUtilityGroup("w-4")).toBe("w");
    expect(getUtilityGroup("h-8")).toBe("h");
    expect(getUtilityGroup("p-4")).toBe("p");
    expect(getUtilityGroup("mt-2")).toBe("mt");
    expect(getUtilityGroup("bg-blue-500")).toBe("bg");
    expect(getUtilityGroup("text-sm")).toBe("text");
    expect(getUtilityGroup("rounded-lg")).toBe("rounded");
  });

  it("returns standalone class name as its own group", () => {
    // Display classes share a group since they all set the display property
    expect(getUtilityGroup("flex")).toBe("__display");
    expect(getUtilityGroup("hidden")).toBe("__display");
    expect(getUtilityGroup("block")).toBe("__display");
    // Non-display standalone classes are their own group
    expect(getUtilityGroup("absolute")).toBe("absolute");
  });

  it("preserves responsive prefixes in group", () => {
    expect(getUtilityGroup("sm:w-4")).toBe("sm:w");
    expect(getUtilityGroup("md:text-lg")).toBe("md:text");
  });

  it("preserves state prefixes in group", () => {
    expect(getUtilityGroup("hover:bg-red-500")).toBe("hover:bg");
    expect(getUtilityGroup("focus:border-blue-500")).toBe("focus:border");
  });

  it("handles negative utilities", () => {
    expect(getUtilityGroup("-mt-4")).toBe("-mt");
    expect(getUtilityGroup("-translate-x-2")).toBe("-translate-x");
  });
});

// --- mergeClasses ---

describe("mergeClasses", () => {
  it("simple addition: appends non-conflicting classes", () => {
    expect(mergeClasses("flex items-center", "p-4")).toBe(
      "flex items-center p-4"
    );
  });

  it("conflict resolution: same group prefix replaces", () => {
    expect(mergeClasses("w-4 h-8", "w-6")).toBe("h-8 w-6");
  });

  it("color conflict: bg group replaces", () => {
    expect(mergeClasses("bg-blue-500 text-white", "bg-red-500")).toBe(
      "text-white bg-red-500"
    );
  });

  it("handles empty existing", () => {
    expect(mergeClasses("", "p-4 m-2")).toBe("p-4 m-2");
  });

  it("handles empty new", () => {
    expect(mergeClasses("flex p-4", "")).toBe("flex p-4");
  });

  it("multiple new classes with conflicts", () => {
    expect(mergeClasses("w-4 h-8 p-2", "w-6 p-4")).toBe("h-8 w-6 p-4");
  });

  it("responsive prefixed classes don't conflict with unprefixed", () => {
    expect(mergeClasses("w-4 sm:w-8", "w-6")).toBe("sm:w-8 w-6");
  });

  it("display classes conflict with each other", () => {
    // flex, hidden, block are all display classes — block replaces both
    expect(mergeClasses("flex hidden", "block")).toBe("block");
  });

  it("non-conflicting standalone classes are preserved", () => {
    expect(mergeClasses("absolute italic", "underline")).toBe("absolute italic underline");
  });
});

// --- findClassNameAttribute ---

describe("findClassNameAttribute", () => {
  it("finds className in double quotes", () => {
    const lines = [
      'export default function App() {',
      '  return <div className="flex items-center p-4">Hello</div>;',
      "}",
    ];
    const result = findClassNameAttribute(lines);
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
    expect(lines[result!.lineIdx].slice(result!.start, result!.end)).toBe(
      "flex items-center p-4"
    );
  });

  it("finds className in single quotes", () => {
    const lines = [
      "export default function App() {",
      "  return <div className={'flex items-center p-4'}>Hello</div>;",
      "}",
    ];
    const result = findClassNameAttribute(lines);
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
    expect(lines[result!.lineIdx].slice(result!.start, result!.end)).toBe(
      "flex items-center p-4"
    );
  });

  it("finds className in template literal", () => {
    const lines = [
      "export default function App() {",
      "  return <div className={`flex items-center p-4`}>Hello</div>;",
      "}",
    ];
    const result = findClassNameAttribute(lines);
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
    expect(result!.quote).toBe("`");
    expect(lines[result!.lineIdx].slice(result!.start, result!.end)).toBe(
      "flex items-center p-4"
    );
  });

  it("finds className inside cn() wrapper", () => {
    const lines = [
      "export default function App() {",
      '  return <div className={cn("flex items-center", "p-4")}>Hello</div>;',
      "}",
    ];
    const result = findClassNameAttribute(lines);
    expect(result).not.toBeNull();
    expect(result!.isCnWrapper).toBe(true);
    expect(lines[result!.lineIdx].slice(result!.start, result!.end)).toBe(
      "flex items-center"
    );
  });

  it("searches near targetLine first", () => {
    const lines = [
      'const a = <span className="text-sm">A</span>;',
      "const b = <div>B</div>;",
      "const c = <div>C</div>;",
      "const d = <div>D</div>;",
      'const e = <p className="text-lg font-bold">E</p>;',
    ];
    // targetLine is 1-indexed, pointing to line 5 (index 4)
    const result = findClassNameAttribute(lines, 5);
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(4);
    expect(lines[result!.lineIdx].slice(result!.start, result!.end)).toBe(
      "text-lg font-bold"
    );
  });

  it("finds className without targetLine (full file search)", () => {
    const lines = [
      "export default function App() {",
      "  return (",
      "    <div>",
      '      <p className="text-base">Hello</p>',
      "    </div>",
      "  );",
      "}",
    ];
    const result = findClassNameAttribute(lines);
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(3);
  });

  it("returns null when no className exists", () => {
    const lines = [
      "export default function App() {",
      "  return <div>Hello</div>;",
      "}",
    ];
    const result = findClassNameAttribute(lines);
    expect(result).toBeNull();
  });
});

// --- handleTailwindCommit (integration) ---

describe("handleTailwindCommit", () => {
  it("writes merged classes to a JSX file at target line", async () => {
    const filePath = "src/App.tsx";
    await writeFixture(
      filePath,
      [
        "export default function App() {",
        '  return <div className="flex items-center w-4">Hello</div>;',
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 2,
          existingClasses: "flex items-center w-4",
          newClasses: "w-6 p-4",
        },
      ],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("flex items-center w-6 p-4");
    expect(content).not.toContain("w-4");
  });

  it("finds className without target line (full file search)", async () => {
    const filePath = "src/Page.tsx";
    await writeFixture(
      filePath,
      [
        "export default function Page() {",
        "  return (",
        "    <main>",
        '      <h1 className="text-2xl font-bold">Title</h1>',
        "    </main>",
        "  );",
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          existingClasses: "text-2xl font-bold",
          newClasses: "text-3xl",
        },
      ],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("font-bold text-3xl");
    expect(content).not.toContain("text-2xl");
  });

  it("handles template literal className", async () => {
    const filePath = "src/Card.tsx";
    await writeFixture(
      filePath,
      [
        "export function Card() {",
        "  return <div className={`bg-white rounded-lg p-4`}>Card</div>;",
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 2,
          existingClasses: "bg-white rounded-lg p-4",
          newClasses: "p-6",
        },
      ],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("bg-white rounded-lg p-6");
    expect(content).not.toContain("p-4");
  });

  it("handles cn/clsx wrapper", async () => {
    const filePath = "src/Button.tsx";
    await writeFixture(
      filePath,
      [
        "export function Button() {",
        '  return <button className={cn("flex p-4", variant)}>Click</button>;',
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 2,
          existingClasses: "flex p-4",
          newClasses: "p-6",
        },
      ],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("flex p-6");
    expect(content).not.toContain("p-4");
  });

  it("rejects path traversal", async () => {
    const result = await handleTailwindCommit(
      [
        {
          sourceFile: "../../../etc/passwd",
          existingClasses: "",
          newClasses: "flex",
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("Path traversal");
  });

  it("reports failure for missing source file", async () => {
    const result = await handleTailwindCommit(
      [
        {
          sourceFile: "src/NonExistent.tsx",
          existingClasses: "flex",
          newClasses: "p-4",
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("file error");
  });

  it("reports failure when no className attribute found", async () => {
    const filePath = "src/NoClass.tsx";
    await writeFixture(
      filePath,
      [
        "export function NoClass() {",
        "  return <div>No class here</div>;",
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          existingClasses: "",
          newClasses: "flex",
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("className attribute not found");
  });

  it("reports failure when no sourceFile specified", async () => {
    const result = await handleTailwindCommit(
      [
        {
          sourceFile: "",
          existingClasses: "flex",
          newClasses: "p-4",
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
  });
});

// ─── Wiring: EnrichedChange shape matches TailwindChange ─────────────

describe("client→server field compatibility", () => {
  it("EnrichedChange with mode=tailwind has all fields TailwindChange needs", async () => {
    // Simulate the enriched change shape from commitUtils.ts
    const enriched = {
      prop: "display",
      from: "flex",
      to: "grid",
      sourceFile: "src/App.tsx",
      sourceLine: 2,
      mode: "tailwind" as const,
      newClasses: "grid",
      existingClasses: "flex items-center",
    };

    const filePath = enriched.sourceFile;
    await writeFixture(
      filePath,
      [
        "export default function App() {",
        '  return <div className="flex items-center">Hello</div>;',
        "}",
      ].join("\n")
    );

    // The server handler should accept this shape directly
    const result = await handleTailwindCommit([enriched], tempDir);
    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    // mergeClasses keeps non-conflicting existing classes first, then appends new
    expect(content).toContain("items-center grid");
    expect(content).not.toContain('"flex items-center"');
  });
});

// ─── findFileByClassName fallback ─────────────────────────────────────

describe("findFileByClassName fallback", () => {
  it("finds file when sourceFile is missing but existingClasses is provided", async () => {
    await writeFixture(
      "src/components/Card.tsx",
      [
        "export function Card() {",
        '  return <div className="flex items-center p-4">Card</div>;',
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: "",
          existingClasses: "flex items-center p-4",
          newClasses: "grid",
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(1);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(
      join(tempDir, "src/components/Card.tsx"),
      "utf-8"
    );
    expect(content).toContain("items-center p-4 grid");
    expect(content).not.toContain('"flex items-center p-4"');
  });

  it("fails gracefully when className doesn't match any file", async () => {
    // Write a file with a DIFFERENT className so the search has something to scan
    await writeFixture(
      "src/Other.tsx",
      [
        "export function Other() {",
        '  return <div className="text-sm">Other</div>;',
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: "",
          existingClasses: "nonexistent-class-string-xyz",
          newClasses: "p-4",
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("no source file specified");
  });

  it("handles multiple className attributes in same file — finds correct one", async () => {
    // Two different className attributes on separate lines
    await writeFixture(
      "src/Multi.tsx",
      [
        "export function Multi() {",
        "  return (",
        "    <div>",
        '      <header className="bg-white border-b p-2">Header</header>',
        '      <main className="flex items-center gap-4">Content</main>',
        "    </div>",
        "  );",
        "}",
      ].join("\n")
    );

    // Target the second className by providing its exact classes
    const result = await handleTailwindCommit(
      [
        {
          sourceFile: "src/Multi.tsx",
          sourceLine: 5,
          existingClasses: "flex items-center gap-4",
          newClasses: "gap-8",
        },
      ],
      tempDir
    );

    expect(result.written).toContain("src/Multi.tsx");
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, "src/Multi.tsx"), "utf-8");
    // The second className should be updated
    expect(content).toContain("flex items-center gap-8");
    expect(content).not.toContain("gap-4");
    // The first className should be untouched
    expect(content).toContain("bg-white border-b p-2");
  });
});

// ─── Conflict-aware merge edge cases ──────────────────────────────────

describe("mergeClasses edge cases", () => {
  it("handles responsive prefixes correctly", () => {
    const result = mergeClasses("sm:w-4 md:w-6", "sm:w-8");
    // sm:w-4 should be replaced by sm:w-8, md:w-6 kept
    expect(result).toBe("md:w-6 sm:w-8");
  });

  it("handles negative values", () => {
    const result = mergeClasses("-mt-4 p-2", "-mt-8");
    // -mt-4 should be replaced by -mt-8, p-2 kept
    expect(result).toBe("p-2 -mt-8");
  });

  it("preserves order of non-conflicting classes", () => {
    const result = mergeClasses(
      "flex items-center justify-between text-sm",
      "items-start"
    );
    // items-center replaced by items-start, rest preserved in order
    expect(result).toBe("flex justify-between text-sm items-start");
  });
});

// ─── Safety tests ─────────────────────────────────────────────────────

describe("safety: findFileByClassName fallback", () => {
  it("rejects sourceFile with path traversal via findFileByClassName", async () => {
    // Even if findFileByClassName returns a traversal-looking path,
    // the commit handler should catch it. Here we test that sourceFile
    // with traversal is still caught when provided explicitly alongside
    // a fallback scenario.
    const result = await handleTailwindCommit(
      [
        {
          sourceFile: "../../etc/passwd",
          existingClasses: "flex",
          newClasses: "p-4",
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("Path traversal");
  });

  it("rejects absolute path in sourceFile", async () => {
    const result = await handleTailwindCommit(
      [
        {
          sourceFile: "/etc/passwd",
          existingClasses: "flex",
          newClasses: "p-4",
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
  });
});

// ─── Issue #42: duplicate className disambiguation ───────────────────

describe("duplicate className disambiguation (issue #42)", () => {
  it("targets the SECOND div when sourceLine points to it (two identical classNames)", async () => {
    const filePath = "src/DupTarget.tsx";
    await writeFixture(
      filePath,
      [
        "export default function DupTarget() {",
        "  return (",
        "    <div>",
        '      <div className="btn-primary">First</div>',
        '      <div className="btn-primary">Second</div>',
        "    </div>",
        "  );",
        "}",
      ].join("\n")
    );

    // sourceLine 5 = the SECOND <div className="btn-primary"> (1-indexed)
    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 5,
          existingClasses: "btn-primary",
          newClasses: "p-6",
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(filePath);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    const lines = content.split("\n");

    // FIRST div (line 4 / index 3) must be unchanged
    expect(lines[3]).toContain('className="btn-primary"');
    expect(lines[3]).not.toContain("p-6");

    // SECOND div (line 5 / index 4) must have the new classes merged
    expect(lines[4]).toContain("btn-primary p-6");
  });

  it("refuses to save (returns error) when className is ambiguous and sourceLine is absent", async () => {
    const filePath = "src/DupNoLine.tsx";
    await writeFixture(
      filePath,
      [
        "export default function DupNoLine() {",
        "  return (",
        "    <div>",
        '      <div className="btn-primary">First</div>',
        '      <div className="btn-primary">Second</div>',
        "    </div>",
        "  );",
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          // no sourceLine
          existingClasses: "btn-primary",
          newClasses: "p-6",
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/ambiguous/i);

    // File contents must be unchanged
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).not.toContain("p-6");
  });

  it("picks the closest className occurrence to sourceLine when several duplicates exist", async () => {
    const filePath = "src/DupClosest.tsx";
    await writeFixture(
      filePath,
      [
        "export default function DupClosest() {",                       // 1
        "  return (",                                                    // 2
        "    <div>",                                                     // 3
        '      <div className="btn-primary">First</div>',                // 4
        "      <span>spacer</span>",                                     // 5
        "      <span>spacer</span>",                                     // 6
        '      <div className="btn-primary">Second</div>',               // 7
        "      <span>spacer</span>",                                     // 8
        "      <span>spacer</span>",                                     // 9
        '      <div className="btn-primary">Third</div>',                // 10
        "    </div>",                                                    // 11
        "  );",                                                          // 12
        "}",                                                             // 13
      ].join("\n")
    );

    // sourceLine 7 targets the MIDDLE className (closest match)
    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          sourceLine: 7,
          existingClasses: "btn-primary",
          newClasses: "p-6",
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(filePath);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    const lines = content.split("\n");

    // First (index 3) and Third (index 9) unchanged
    expect(lines[3]).toContain('className="btn-primary"');
    expect(lines[3]).not.toContain("p-6");
    expect(lines[9]).toContain('className="btn-primary"');
    expect(lines[9]).not.toContain("p-6");

    // Middle (index 6) updated
    expect(lines[6]).toContain("btn-primary p-6");
  });

  it("baseline: unique className still works when sourceLine is absent (no regression)", async () => {
    const filePath = "src/UniqueClass.tsx";
    await writeFixture(
      filePath,
      [
        "export default function UniqueClass() {",
        '  return <div className="only-one bg-white">Solo</div>;',
        "}",
      ].join("\n")
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: filePath,
          // no sourceLine — single match, must succeed
          existingClasses: "only-one bg-white",
          newClasses: "p-4",
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(filePath);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("only-one bg-white p-4");
  });
});
