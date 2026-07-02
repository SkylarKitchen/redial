/**
 * Issue #108 — the Playwright Docker image tag must match the installed
 * @playwright/test version.
 *
 * scripts/visual-test.sh runs the visual-regression sweep inside
 * `mcr.microsoft.com/playwright:vX.Y.Z-<distro>`. The host-mounted runner
 * (node_modules/@playwright/test) must match the container's browser build:
 * package.json declares a caret range, so a routine `npm update` can bump the
 * installed runner past the hardcoded tag — Playwright then rejects the
 * mismatched browsers or runs flakily, breaking `npm run test:visual` on
 * exactly the machines (macOS + Santa) that have no fallback path.
 *
 * This guard fails fast in `npm test` when the two drift. To fix a failure:
 * update the IMAGE tag in scripts/visual-test.sh to the installed version
 * (or vice versa).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);

describe("Playwright Docker image tag (#108)", () => {
  const script = readFileSync(resolve(repoRoot, "scripts/visual-test.sh"), "utf8");
  const installed: string = require("@playwright/test/package.json").version;

  it("visual-test.sh pins a parseable mcr.microsoft.com/playwright tag", () => {
    const match = script.match(/mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-/);
    expect(match, "IMAGE tag not found in scripts/visual-test.sh").not.toBeNull();
  });

  it("the image tag version matches the installed @playwright/test version", () => {
    const tagVersion = script.match(/mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-/)?.[1];
    expect(
      tagVersion,
      `Docker image tag v${tagVersion} in scripts/visual-test.sh does not match ` +
        `the installed @playwright/test ${installed}. Update the IMAGE tag ` +
        `(or the dependency) so the host-mounted runner matches the container browsers.`,
    ).toBe(installed);
  });
});
