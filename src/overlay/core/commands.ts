/**
 * commands.ts — Command registry for hotkeys and command palette
 *
 * THE single dispatch surface for all overlay commands (issue #148). Hotkeys
 * map key-combo → command id and dispatch; CommandPalette lists registry
 * entries and dispatches. Same run() path for both, so they can never drift.
 *
 * Commands receive a CommandContext built once in Overlay (the scopeCtx, selected
 * element, panel setters — the former deps bag) and return void. Text-input
 * guards (hasTextControlSelection, scrub-active checks) belong to the dispatch
 * layer (useOverlayHotkeys), not individual commands.
 *
 * Pure refactor: zero user-visible behavior change. All keyboard shortcuts keep
 * their current guards and effects.
 */

import type { Scope } from "./scope";
import type { ScopeContext } from "./engine";
import type { ActivePanel, ActiveModal } from "../shell/overlayTypes";

// ─── Command Context ─────────────────────────────────────────────────

/**
 * The context object built once in Overlay and passed to every command's run()
 * and isEnabled() functions. This is the former OverlayHotkeysDeps bag,
 * collapsed into ONE memoized bundle.
 */
export interface CommandContext {
  // --- Core state ---
  selectedEl: Element | null;
  /** Overlay's ONE memoized scoping bundle (scope ▸ class ▸ state ▸ breakpoint). */
  scopeCtx: ScopeContext;
  cssClasses: string[];
  diffMode: boolean;
  focusMode: boolean;
  activePanel: ActivePanel;
  expandedSection: string | null;

  // --- Callbacks ---
  announce: (message: string) => void;
  refreshPanel: (el: Element) => void;
  handleScopeChange: (newScope: Scope, cls?: string) => void;
  handleResetAll: () => void;
  handleCloseAttempt: () => void;

  // --- Refs for shortcut-specific handlers ---
  /**
   * Save shortcut delegates to Footer's save handler (passed as ref from Overlay).
   * Commands that need the full save flow (validate, commit, announce) call this.
   */
  handleSaveShortcut: () => void;
  /**
   * Copy shortcut delegates to Footer's copy handler.
   */
  handleCopyShortcut: () => void;
  /**
   * Paste styles handler (batched paste through the engine at active breakpoint).
   */
  handlePasteStyles: () => void;
  /**
   * Toggle diff mode (D key hold-to-peek).
   */
  handleToggleDiff: () => void;

  // --- Setters ---
  setShowNavigator: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
  setFocusMode: React.Dispatch<React.SetStateAction<boolean>>;
  setPinned: React.Dispatch<React.SetStateAction<boolean>>;
  setChangesDrawerTab: React.Dispatch<React.SetStateAction<"pending" | "history">>;
  setChangesDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowBoxModel: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGridOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  setActivePanel: React.Dispatch<React.SetStateAction<ActivePanel>>;
  setExpandedSection: React.Dispatch<React.SetStateAction<string | null>>;
  setClipboardMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

// ─── Command Definition ──────────────────────────────────────────────

export type CommandCategory = "edit" | "navigate" | "view" | "copy";

export interface Command {
  /** Unique identifier (kebab-case, like "save", "undo", "toggle-navigator"). */
  id: string;
  /** Display name for command palette (like "Save", "Undo"). */
  title: string;
  /** Category for grouping in the palette. */
  category: CommandCategory;
  /** Execute the command. */
  run: (ctx: CommandContext) => void | Promise<void>;
  /** Optional: check if the command is currently enabled. */
  isEnabled?: (ctx: CommandContext) => boolean;
}

// ─── Registry ────────────────────────────────────────────────────────

const _registry = new Map<string, Command>();

/**
 * Register a command in the global registry. Called at module init for all
 * built-in commands.
 */
export function registerCommand(command: Command): void {
  _registry.set(command.id, command);
}

/**
 * Retrieve a command by id. Returns undefined if not found.
 */
export function getCommand(id: string): Command | undefined {
  return _registry.get(id);
}

/**
 * List all registered commands (for command palette).
 */
export function listCommands(): Command[] {
  return Array.from(_registry.values());
}

/**
 * Execute a command by id. Returns true if the command was found and executed,
 * false if not found or disabled.
 */
export function executeCommand(id: string, ctx: CommandContext): boolean {
  const cmd = _registry.get(id);
  if (!cmd) return false;
  if (cmd.isEnabled && !cmd.isEnabled(ctx)) return false;
  cmd.run(ctx);
  return true;
}

// ─── Built-in Commands ───────────────────────────────────────────────

// Re-export from apply.ts so commands can import everything from one place
import {
  overrideCount,
  reset,
  copyStyles,
  pasteStyles,
  diff,
} from "./apply";
import { styleEngine } from "./engine";
import { SECTION_ORDER } from "../panelUtils";
import { formatTailwindDiff } from "../tailwind";

// --- Edit commands ---

registerCommand({
  id: "save",
  title: "Save",
  category: "edit",
  run: (ctx) => {
    ctx.handleSaveShortcut();
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && overrideCount(ctx.selectedEl) > 0;
  },
});

registerCommand({
  id: "undo",
  title: "Undo",
  category: "edit",
  run: (ctx) => {
    if (!ctx.selectedEl) return;
    const result = styleEngine.undo();
    if (result) {
      ctx.refreshPanel(result.el);
      ctx.announce("Undo");
    }
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && !ctx.diffMode;
  },
});

registerCommand({
  id: "redo",
  title: "Redo",
  category: "edit",
  run: (ctx) => {
    if (!ctx.selectedEl) return;
    const result = styleEngine.redo();
    if (result) {
      ctx.refreshPanel(result.el);
      ctx.announce("Redo");
    }
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && !ctx.diffMode;
  },
});

registerCommand({
  id: "reset",
  title: "Reset",
  category: "edit",
  run: (ctx) => {
    if (!ctx.selectedEl) return;
    if (overrideCount(ctx.selectedEl) > 0) {
      reset(ctx.selectedEl);
      ctx.refreshPanel(ctx.selectedEl);
      ctx.announce("Reset");
    }
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && overrideCount(ctx.selectedEl) > 0 && !ctx.diffMode;
  },
});

registerCommand({
  id: "reset-all",
  title: "Reset All",
  category: "edit",
  run: (ctx) => {
    ctx.handleResetAll();
    ctx.announce("Reset all");
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && !ctx.diffMode;
  },
});

// --- Copy commands ---

registerCommand({
  id: "copy-css",
  title: "Copy CSS",
  category: "copy",
  run: (ctx) => {
    ctx.handleCopyShortcut();
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && overrideCount(ctx.selectedEl) > 0;
  },
});

registerCommand({
  id: "copy-tailwind",
  title: "Copy Tailwind",
  category: "copy",
  run: (ctx) => {
    if (!ctx.selectedEl) return;
    const changes = diff(ctx.selectedEl);
    if (changes.length > 0) {
      // Responsive edits keep their sm:/md:/lg:/xl: variant prefix.
      navigator.clipboard.writeText(formatTailwindDiff(changes)).catch(() => {});
      ctx.setClipboardMessage("Tailwind classes copied");
    }
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && overrideCount(ctx.selectedEl) > 0;
  },
});

registerCommand({
  id: "copy-styles",
  title: "Copy Styles",
  category: "copy",
  run: (ctx) => {
    if (!ctx.selectedEl) return;
    const count = copyStyles(ctx.selectedEl);
    if (count > 0) {
      ctx.setClipboardMessage(`${count} style${count === 1 ? "" : "s"} copied`);
    }
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "paste-styles",
  title: "Paste Styles",
  category: "copy",
  run: (ctx) => {
    ctx.handlePasteStyles();
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && !ctx.diffMode;
  },
});

// --- View commands ---

registerCommand({
  id: "toggle-diff",
  title: "Toggle Diff",
  category: "view",
  run: (ctx) => {
    ctx.handleToggleDiff();
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && overrideCount(ctx.selectedEl) > 0;
  },
});

registerCommand({
  id: "toggle-navigator",
  title: "Toggle Navigator",
  category: "navigate",
  run: (ctx) => {
    ctx.setShowNavigator((v) => !v);
  },
});

registerCommand({
  id: "toggle-changes-drawer",
  title: "Toggle Changes Drawer",
  category: "view",
  run: (ctx) => {
    ctx.setChangesDrawerTab("history");
    ctx.setChangesDrawerOpen((v) => !v);
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "toggle-box-model",
  title: "Toggle Box Model",
  category: "view",
  run: (ctx) => {
    ctx.setShowBoxModel((v) => !v);
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "toggle-grid-overlay",
  title: "Toggle Grid Overlay",
  category: "view",
  run: (ctx) => {
    ctx.setShowGridOverlay((v) => !v);
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "toggle-focus-mode",
  title: "Toggle Focus Mode",
  category: "view",
  run: (ctx) => {
    ctx.setFocusMode((prev) => !prev);
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "toggle-tab",
  title: "Toggle Style / AI Tab",
  category: "view",
  run: (ctx) => {
    ctx.setActivePanel((prev) =>
      prev.type === "inspector" && prev.tab === "custom"
        ? { type: "inspector", tab: "prompt" }
        : { type: "inspector", tab: "custom" }
    );
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "toggle-pin",
  title: "Toggle Pin",
  category: "navigate",
  run: (ctx) => {
    ctx.setPinned((p) => !p);
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

// --- Navigate commands ---

registerCommand({
  id: "cycle-scope",
  title: "Cycle Scope",
  category: "navigate",
  run: (ctx) => {
    // Cycle between "element" and "class" scope
    // Only cycle if there are CSS classes available
    if (ctx.cssClasses.length > 0) {
      if (ctx.scopeCtx.scope === "element") {
        ctx.handleScopeChange("class", ctx.cssClasses[0]);
      } else {
        ctx.handleScopeChange("element");
      }
    }
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null && ctx.cssClasses.length > 0;
  },
});

registerCommand({
  id: "section-next",
  title: "Next Section",
  category: "navigate",
  run: (ctx) => {
    if (!ctx.focusMode) ctx.setFocusMode(true);
    if (!(ctx.activePanel.type === "inspector" && ctx.activePanel.tab === "custom")) {
      ctx.setActivePanel({ type: "inspector", tab: "custom" });
    }
    const currentIdx = ctx.expandedSection
      ? SECTION_ORDER.indexOf(ctx.expandedSection as typeof SECTION_ORDER[number])
      : -1;
    const nextIdx = currentIdx < SECTION_ORDER.length - 1 ? currentIdx + 1 : 0;
    ctx.setExpandedSection(SECTION_ORDER[nextIdx]);
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "section-prev",
  title: "Previous Section",
  category: "navigate",
  run: (ctx) => {
    if (!ctx.focusMode) ctx.setFocusMode(true);
    if (!(ctx.activePanel.type === "inspector" && ctx.activePanel.tab === "custom")) {
      ctx.setActivePanel({ type: "inspector", tab: "custom" });
    }
    const currentIdx = ctx.expandedSection
      ? SECTION_ORDER.indexOf(ctx.expandedSection as typeof SECTION_ORDER[number])
      : -1;
    const nextIdx = currentIdx > 0 ? currentIdx - 1 : SECTION_ORDER.length - 1;
    ctx.setExpandedSection(SECTION_ORDER[nextIdx]);
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

// Section jump commands (1-8)
SECTION_ORDER.forEach((section, idx) => {
  registerCommand({
    id: `section-jump-${idx + 1}`,
    title: `Jump to ${section}`,
    category: "navigate",
    run: (ctx) => {
      if (!ctx.focusMode) ctx.setFocusMode(true);
      ctx.setExpandedSection(section);
      // Ensure we're on the Style tab
      if (!(ctx.activePanel.type === "inspector" && ctx.activePanel.tab === "custom")) {
        ctx.setActivePanel({ type: "inspector", tab: "custom" });
      }
    },
    isEnabled: (ctx) => {
      return ctx.selectedEl !== null;
    },
  });
});

registerCommand({
  id: "toggle-search",
  title: "Toggle Property Search",
  category: "navigate",
  run: (ctx) => {
    ctx.setShowSearch((v) => {
      if (v) {
        // Closing: clear query too
        ctx.setSearchQuery("");
        return false;
      }
      return true;
    });
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "open-search",
  title: "Open Property Search",
  category: "navigate",
  run: (ctx) => {
    ctx.setShowSearch(true);
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "command-palette",
  title: "Command Palette",
  category: "navigate",
  run: (ctx) => {
    ctx.setActiveModal((prev) =>
      prev.type === "commandPalette" ? { type: "none" } : { type: "commandPalette" }
    );
  },
  isEnabled: (ctx) => {
    return ctx.selectedEl !== null;
  },
});

registerCommand({
  id: "shortcuts-help",
  title: "Keyboard Shortcuts Help",
  category: "navigate",
  run: (ctx) => {
    ctx.setActiveModal((prev) =>
      prev.type === "shortcutsHelp" ? { type: "none" } : { type: "shortcutsHelp" }
    );
  },
});
