/**
 * OverlayModals.tsx — the transient modals layered over the page: the Cmd+K
 * command palette, the right-click context menu, and the shortcuts-help sheet.
 *
 * Extracted verbatim from Overlay.tsx. Exactly one is shown at a time, keyed off
 * the `activeModal` discriminated union. The inline open/close/select closures
 * are preserved byte-for-byte; callback prop types are derived from the modal
 * components so no shared action enums need exporting.
 */

import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { CommandPalette } from "./CommandPalette";
import { ContextMenu } from "./ContextMenu";
import { ShortcutsHelp } from "./ShortcutsHelp";
import type { ActiveModal } from "./overlayTypes";

export interface OverlayModalsProps {
  activeModal: ActiveModal;
  selectedEl: Element | null;
  setActiveModal: Dispatch<SetStateAction<ActiveModal>>;
  onSelectElement: (el: Element) => void;
  setShowSearch: Dispatch<SetStateAction<boolean>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  onExecuteCommand: ComponentProps<typeof CommandPalette>["onExecuteCommand"];
  onContextAction: ComponentProps<typeof ContextMenu>["onAction"];
}

export function OverlayModals({
  activeModal,
  selectedEl,
  setActiveModal,
  onSelectElement,
  setShowSearch,
  setSearchQuery,
  onExecuteCommand,
  onContextAction,
}: OverlayModalsProps) {
  return (
    <>
      {/* Command Palette modal */}
      {activeModal.type === "commandPalette" && selectedEl && (
        <CommandPalette
          onSelectElement={(el) => { onSelectElement(el); setActiveModal({ type: "none" }); }}
          onScrollToSection={(section) => {
            setShowSearch(true);
            setSearchQuery(section);
            setActiveModal({ type: "none" });
          }}
          onExecuteCommand={(commandId) => { onExecuteCommand(commandId); setActiveModal({ type: "none" }); }}
          onClose={() => setActiveModal({ type: "none" })}
        />
      )}

      {/* Context Menu */}
      {activeModal.type === "contextMenu" && selectedEl && (
        <ContextMenu
          x={activeModal.x}
          y={activeModal.y}
          element={selectedEl}
          onAction={onContextAction}
          onClose={() => setActiveModal({ type: "none" })}
        />
      )}

      {/* Shortcuts Help modal */}
      {activeModal.type === "shortcutsHelp" && (
        <ShortcutsHelp onClose={() => setActiveModal({ type: "none" })} />
      )}
    </>
  );
}
