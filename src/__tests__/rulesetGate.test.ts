import { describe, it, expect } from "vitest";

// Deliberately failing test — live-fire check that the protect-main ruleset
// blocks merging a PR whose required `verify` check is red. This PR is never
// meant to merge; it gets closed after the rejection is observed.
describe("protect-main merge gate", () => {
  it("fails on purpose so the verify check goes red", () => {
    expect("this PR").toBe("unmergeable");
  });
});
