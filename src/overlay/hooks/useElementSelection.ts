/**
 * useElementSelection.ts — element selection / close lifecycle callbacks
 *
 * Bundles Overlay's selection-lifecycle handlers: selecting an element,
 * cancelling selection mode, breadcrumb navigation, and the close /
 * close-with-unsaved-changes-warning flow.
 *
 * Extracted verbatim from Overlay.tsx — behavior and dependency arrays are
 * preserved exactly. Every value, setter and ref each callback closes over is
 * passed in explicitly so the hook never reaches back into Overlay's scope.
 * The shared refs (selectedElRef, selectedSelectorRef, pendingTabRef) stay
 * owned by Overlay and are threaded through here so other effects observe the
 * same instances.
 */

import { useCallback } from "react";
import { infer, type InferResult } from "../core/infer";
import { getStableSelector } from "../util";
import { getCSSModuleClasses, type Scope } from "../core/scope";
import { overrideCount } from "../core/apply";
import type { ActivePanel, ActiveModal } from "../shell/overlayTypes";

export interface ElementSelectionDeps {
  selectedElRef: React.MutableRefObject<Element | null>;
  selectedSelectorRef: React.MutableRefObject<string | null>;
  pendingTabRef: React.MutableRefObject<"prompt" | null>;
  announce: (message: string) => void;
  setSelecting: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedEl: React.Dispatch<React.SetStateAction<Element | null>>;
  setPinned: React.Dispatch<React.SetStateAction<boolean>>;
  setInferResult: React.Dispatch<React.SetStateAction<InferResult | null>>;
  /** Re-infer the selected element and remount the panel. */
  refreshPanel: (el: Element) => void;
  setScope: React.Dispatch<React.SetStateAction<Scope>>;
  setActiveClassName: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveState: React.Dispatch<React.SetStateAction<string>>;
  setActivePanel: React.Dispatch<React.SetStateAction<ActivePanel>>;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
  setShowNavigator: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGridOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  setShowBoxModel: React.Dispatch<React.SetStateAction<boolean>>;
  setExpandedSection: React.Dispatch<React.SetStateAction<string | null>>;
  setChangesDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setCloseWarning: React.Dispatch<React.SetStateAction<boolean>>;
  setHoveredAncestor: React.Dispatch<React.SetStateAction<Element | null>>;
  setPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setAnchor: React.Dispatch<React.SetStateAction<"left" | "right" | null>>;
}

export interface ElementSelection {
  handleSelect: (el: Element) => void;
  handleCancel: () => void;
  handleBreadcrumbClick: (el: Element) => void;
  handleClose: () => void;
  handleCloseAttempt: () => void;
}

export function useElementSelection({
  selectedElRef,
  selectedSelectorRef,
  pendingTabRef,
  announce,
  setSelecting,
  setSelectedEl,
  setPinned,
  setInferResult,
  refreshPanel,
  setScope,
  setActiveClassName,
  setActiveState,
  setActivePanel,
  setActiveModal,
  setShowNavigator,
  setShowGridOverlay,
  setShowBoxModel,
  setExpandedSection,
  setChangesDrawerOpen,
  setShowSearch,
  setSearchQuery,
  setCloseWarning,
  setHoveredAncestor,
  setPos,
  setAnchor,
}: ElementSelectionDeps): ElementSelection {
  // --- Close handler ---
  const handleClose = useCallback(() => {
    setSelectedEl(null);
    selectedSelectorRef.current = null;
    setInferResult(null);
    setScope("element");
    setActiveClassName(null);
    setActiveState("none");
    setShowSearch(false);
    setSearchQuery("");
    setActivePanel({ type: "none" });
    setActiveModal({ type: "none" });
    setCloseWarning(false);
    setShowNavigator(false);
    announce("Element deselected");
  }, [announce]);

  const handleCloseAttempt = useCallback(() => {
    if (selectedElRef.current && overrideCount(selectedElRef.current) > 0) {
      setCloseWarning(true);
    } else {
      handleClose();
    }
  }, [handleClose]);

  // --- Element selection ---
  const handleSelect = useCallback((el: Element) => {
    setSelecting(false);
    setSelectedEl(el);
    setPinned(false);
    selectedSelectorRef.current = getStableSelector(el);
    refreshPanel(el);
    // Default to class scope when classes detected, element otherwise
    const classes = getCSSModuleClasses(el);
    if (classes.length > 0) {
      setScope("class");
      setActiveClassName(classes[0]);
    } else {
      setScope("element");
      setActiveClassName(null);
    }
    const queuedTab = pendingTabRef.current;
    pendingTabRef.current = null;
    setActivePanel({ type: "inspector", tab: queuedTab ?? "custom" });
    setShowNavigator(true);
    setShowGridOverlay(false);
    setShowBoxModel(false);
    setExpandedSection(null);
    setChangesDrawerOpen(false);
    setShowSearch(false);
    setSearchQuery("");
    setActiveModal({ type: "none" });
    setCloseWarning(false);
    // Screen reader announcement
    const tag = el.tagName.toLowerCase();
    const cls = el.classList.length > 0 ? el.classList[0] : "";
    announce(`Selected ${tag}${cls ? `.${cls}` : ""}`);
    // Reset position to top-right default
    setPos({ x: window.innerWidth - 300 - 16, y: 16 });
    setAnchor("right");
  }, []);

  const handleCancel = useCallback(() => {
    setSelecting(false);
    pendingTabRef.current = null;
  }, []);

  // --- Breadcrumb click handler (Phase 2) ---
  const handleBreadcrumbClick = useCallback((el: Element) => {
    setHoveredAncestor(null);
    setSelectedEl(el);
    selectedSelectorRef.current = getStableSelector(el);
    refreshPanel(el);
  }, []);

  return { handleSelect, handleCancel, handleBreadcrumbClick, handleClose, handleCloseAttempt };
}
