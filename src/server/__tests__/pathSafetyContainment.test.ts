/**
 * pathSafetyContainment.test.ts — issue #69.
 *
 * assertWithinRoot built its prefix check as `path.startsWith(root + "/")`,
 * hardcoding the POSIX separator. On Windows, path.normalize produces
 * backslash separators, so a legitimate in-root path like
 * `C:\proj\src\a.scss` never starts with `C:\proj/` — the guard threw
 * "Path traversal detected" for every file and no save could ever succeed.
 *
 * process.platform can't be flipped in a test, so the containment logic
 * accepts an injectable PlatformPath (defaulting to the host's `path`), and
 * these tests exercise it with `path.win32` / `path.posix` directly.
 */

import { describe, it, expect } from "vitest";
import { posix, win32 } from "path";
import { assertWithinRoot } from "../pathSafety";

describe("assertWithinRoot — POSIX (host default)", () => {
  it("accepts a file inside the root", () => {
    expect(() => assertWithinRoot("/root/src/a.css", "/root")).not.toThrow();
  });

  it("accepts the root itself", () => {
    expect(() => assertWithinRoot("/root", "/root")).not.toThrow();
  });

  it("rejects a sibling directory sharing the root as a string prefix", () => {
    // "/root-evil" starts with "/root" as a plain string — the separator-aware
    // check must still reject it.
    expect(() => assertWithinRoot("/root-evil/a.css", "/root")).toThrow(
      /path traversal/i,
    );
  });

  it("rejects an absolute path outside the root", () => {
    expect(() => assertWithinRoot("/etc/passwd", "/root")).toThrow(
      /path traversal/i,
    );
  });

  it("rejects the parent of the root", () => {
    expect(() => assertWithinRoot("/", "/root")).toThrow(/path traversal/i);
  });

  it("behaves identically with posix explicitly injected", () => {
    expect(() =>
      assertWithinRoot("/root/src/a.css", "/root", posix),
    ).not.toThrow();
    expect(() => assertWithinRoot("/root-evil/a.css", "/root", posix)).toThrow(
      /path traversal/i,
    );
  });
});

describe("assertWithinRoot — Windows semantics (issue #69)", () => {
  it("accepts an in-root path with backslash separators", () => {
    // The original bug: this threw for EVERY save on Windows.
    expect(() =>
      assertWithinRoot("C:\\proj\\src\\a.scss", "C:\\proj", win32),
    ).not.toThrow();
  });

  it("accepts the root itself", () => {
    expect(() => assertWithinRoot("C:\\proj", "C:\\proj", win32)).not.toThrow();
  });

  it("accepts mixed forward/backslash separators after normalization", () => {
    expect(() =>
      assertWithinRoot("C:/proj/src/a.scss", "C:\\proj", win32),
    ).not.toThrow();
  });

  it("accepts a drive-letter case difference", () => {
    expect(() =>
      assertWithinRoot("c:\\proj\\a.css", "C:\\proj", win32),
    ).not.toThrow();
  });

  it("rejects a sibling directory sharing the root as a string prefix", () => {
    expect(() =>
      assertWithinRoot("C:\\proj-evil\\a.scss", "C:\\proj", win32),
    ).toThrow(/path traversal/i);
  });

  it("rejects a '..' escape after normalization", () => {
    expect(() =>
      assertWithinRoot("C:\\proj\\..\\evil\\a.scss", "C:\\proj", win32),
    ).toThrow(/path traversal/i);
  });

  it("rejects a path on a different drive", () => {
    expect(() =>
      assertWithinRoot("D:\\data\\a.css", "C:\\proj", win32),
    ).toThrow(/path traversal/i);
  });

  it("rejects the parent of the root", () => {
    expect(() => assertWithinRoot("C:\\", "C:\\proj", win32)).toThrow(
      /path traversal/i,
    );
  });
});
