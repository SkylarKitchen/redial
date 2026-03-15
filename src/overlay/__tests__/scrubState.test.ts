import { describe, it, expect, beforeEach } from "vitest";
import { isScrubActive, setScrubActive } from "../core/scrubState";

beforeEach(() => {
  setScrubActive(false);
});

describe("scrubState", () => {
  it("defaults to false", () => {
    expect(isScrubActive()).toBe(false);
  });

  it("can be set to true", () => {
    setScrubActive(true);
    expect(isScrubActive()).toBe(true);
  });

  it("can be toggled back to false", () => {
    setScrubActive(true);
    setScrubActive(false);
    expect(isScrubActive()).toBe(false);
  });

  it("setting same value is idempotent", () => {
    setScrubActive(true);
    setScrubActive(true);
    expect(isScrubActive()).toBe(true);
  });

  it("multiple toggles work correctly", () => {
    setScrubActive(true);
    expect(isScrubActive()).toBe(true);
    setScrubActive(false);
    expect(isScrubActive()).toBe(false);
    setScrubActive(true);
    expect(isScrubActive()).toBe(true);
  });
});
