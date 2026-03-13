// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  addCustomProperty,
  removeCustomProperty,
  renameCustomProperty,
  applyCustomProperty,
  isCustomPropertyDirty,
  undo,
  resetAll,
  totalOverrideCount,
} from "../apply";

// ─── Setup ────────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
});

// ─── addCustomProperty ────────────────────────────────────────────────

describe("addCustomProperty", () => {
  it("valid name applies successfully", () => {
    const el = makeEl();
    addCustomProperty(el, "--color-primary", "#ff0000");
    expect(el.style.getPropertyValue("--color-primary")).toBe("#ff0000");
    expect(isCustomPropertyDirty("--color-primary")).toBe(true);
  });

  it("throws on name without -- prefix", () => {
    const el = makeEl();
    expect(() => addCustomProperty(el, "color-primary", "#ff0000")).toThrow(
      /Invalid custom property name/
    );
  });

  it("throws on name with special characters", () => {
    const el = makeEl();
    expect(() => addCustomProperty(el, "--color primary", "#ff0000")).toThrow(
      /Invalid custom property name/
    );
    expect(() => addCustomProperty(el, "--color.primary", "#ff0000")).toThrow(
      /Invalid custom property name/
    );
    expect(() => addCustomProperty(el, "--color/primary", "#ff0000")).toThrow(
      /Invalid custom property name/
    );
  });
});

// ─── removeCustomProperty ─────────────────────────────────────────────

describe("removeCustomProperty", () => {
  it("removes property from DOM and tracking maps", () => {
    const el = makeEl();
    applyCustomProperty(el, "--spacing", "8px");
    expect(el.style.getPropertyValue("--spacing")).toBe("8px");

    removeCustomProperty(el, "--spacing");
    expect(el.style.getPropertyValue("--spacing")).toBe("");
    expect(isCustomPropertyDirty("--spacing")).toBe(false);
  });

  it("adjusts dirtyCount when removing a dirty override", () => {
    const el = makeEl();
    // Set an initial value on the element so applyCustomProperty sees a
    // non-empty computed initial, making it genuinely dirty.
    (el as HTMLElement).style.setProperty("--spacing", "4px");
    applyCustomProperty(el, "--spacing", "8px");
    const countBefore = totalOverrideCount();
    expect(countBefore).toBeGreaterThan(0);

    removeCustomProperty(el, "--spacing");
    expect(totalOverrideCount()).toBe(countBefore - 1);
  });

  it("undo restores the removed property", () => {
    const el = makeEl();
    applyCustomProperty(el, "--radius", "4px");

    removeCustomProperty(el, "--radius");
    expect(el.style.getPropertyValue("--radius")).toBe("");

    undo();
    // Undo of remove should re-apply the value
    expect(el.style.getPropertyValue("--radius")).toBe("4px");
  });
});

// ─── renameCustomProperty ─────────────────────────────────────────────

describe("renameCustomProperty", () => {
  it("old name gone, new name present", async () => {
    const el = makeEl();
    applyCustomProperty(el, "--old-color", "blue");

    await renameCustomProperty(el, "--old-color", "--new-color");

    expect(el.style.getPropertyValue("--old-color")).toBe("");
    expect(el.style.getPropertyValue("--new-color")).toBe("blue");
  });

  it("undo as single batch restores old name", async () => {
    const el = makeEl();
    applyCustomProperty(el, "--old-name", "10px");

    await renameCustomProperty(el, "--old-name", "--new-name");
    expect(el.style.getPropertyValue("--new-name")).toBe("10px");
    expect(el.style.getPropertyValue("--old-name")).toBe("");

    // Single undo should revert the entire rename (batch)
    undo();
    expect(el.style.getPropertyValue("--old-name")).toBe("10px");
    expect(el.style.getPropertyValue("--new-name")).toBe("");
  });

  it("returns 0 when no replaceRefs callback provided", async () => {
    const el = makeEl();
    applyCustomProperty(el, "--a", "1px");
    const count = await renameCustomProperty(el, "--a", "--b");
    expect(count).toBe(0);
  });

  it("calls replaceRefs callback and returns its result", async () => {
    const el = makeEl();
    applyCustomProperty(el, "--x", "red");
    const mockReplace = (oldN: string, newN: string) => {
      expect(oldN).toBe("--x");
      expect(newN).toBe("--y");
      return 3;
    };
    const count = await renameCustomProperty(el, "--x", "--y", mockReplace);
    expect(count).toBe(3);
  });
});
