import { describe, expect, test } from "vitest";
import {
  branchName,
  classifyFailure,
  buildTaskPrompt,
  resultMark,
  slugify,
} from "../run-tasks-lib";

describe("slugify", () => {
  test("lowercases, replaces non-alphanumerics with hyphens, trims", () => {
    expect(slugify("Add JSDoc to infer.ts!")).toBe("add-jsdoc-to-infer-ts");
  });

  test("truncates to 50 characters", () => {
    const long = "a".repeat(80);
    expect(slugify(long).length).toBe(50);
  });
});

describe("branchName — Bug A: collision", () => {
  // Two tasks whose text truncates to the same 50-char slug, launched in the
  // same millisecond, must still get distinct branch names. The old code
  // (`sandcastle/<slug>-<unix-seconds>`) produced identical names → the second
  // task died on `fatal: branch already exists`.
  test("distinct indices never collide even with identical slug and timestamp", () => {
    const slug = "add-jsdoc-comments-to-every-exported-function-in-s";
    const now = 1780199942000;
    expect(branchName(slug, 0, now)).not.toBe(branchName(slug, 1, now));
  });

  test("is prefixed with sandcastle/ and contains the slug", () => {
    const name = branchName("fix-thing", 2, 1780199942000);
    expect(name.startsWith("sandcastle/fix-thing-")).toBe(true);
  });
});

describe("classifyFailure — Bug A: auth misclassification", () => {
  // A fast failure caused by a branch-name collision must NOT be treated as an
  // auth/rate-limit failure (which aborts the whole fleet).
  test("branch-already-exists is a task failure, not auth, even when fast", () => {
    const msg =
      "fatal: a branch named 'sandcastle/foo-123' already exists";
    expect(classifyFailure(msg, 145)).toBe("task");
  });

  test("a fast generic failure is suspected auth/rate-limit", () => {
    expect(classifyFailure("Not logged in · Please run /login", 800)).toBe(
      "auth",
    );
  });

  test("a slow failure is a task failure regardless of message", () => {
    expect(classifyFailure("some runtime error", 30_000)).toBe("task");
  });
});

describe("buildTaskPrompt — Bug B: agent must commit", () => {
  // sandbox.run() only syncs out commits; uncommitted edits are discarded on
  // teardown. The prompt must tell the agent to commit its work.
  test("appends a git commit instruction to the task text", () => {
    const prompt = buildTaskPrompt("Add JSDoc to infer.ts");
    expect(prompt).toContain("Add JSDoc to infer.ts");
    expect(prompt).toMatch(/git commit/i);
  });
});

describe("resultMark — Bug B: no commit means not done", () => {
  // A run that produced zero commits did not persist any work, so it must not
  // be marked complete ([x]); it's a failure ([!]).
  test("zero commits marks the task failed", () => {
    expect(resultMark(0)).toBe("!");
  });

  test("one or more commits marks the task done", () => {
    expect(resultMark(1)).toBe("x");
    expect(resultMark(5)).toBe("x");
  });
});
