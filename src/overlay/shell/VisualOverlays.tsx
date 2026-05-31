/**
 * VisualOverlays.tsx — the on-page measurement overlays drawn for the selected
 * element: CSS grid lines, box model, ghosted spacing preview, flex-gap hatching,
 * and spacing guides.
 *
 * Extracted verbatim from Overlay.tsx. Overlay gates the whole group on
 * `selectedEl && !selecting`; this component owns the per-overlay enable flags.
 */

import { GridOverlay } from "../overlays/GridOverlay";
import { BoxModelOverlay } from "../overlays/BoxModelOverlay";
import { FlexGapOverlay } from "../overlays/FlexGapOverlay";
import { SpacingGuidesOverlay } from "../overlays/SpacingGuidesOverlay";
import { SpacingPreviewOverlay } from "../overlays/SpacingPreviewOverlay";

export interface VisualOverlaysProps {
  element: Element;
  refreshKey: number;
  isGridContainer: boolean;
  isFlexContainer: boolean;
  showGridOverlay: boolean;
  showBoxModel: boolean;
}

export function VisualOverlays({
  element,
  refreshKey,
  isGridContainer,
  isFlexContainer,
  showGridOverlay,
  showBoxModel,
}: VisualOverlaysProps) {
  return (
    <>
      {/* Grid overlay (only when selected element is a grid container and overlay is enabled) */}
      {isGridContainer && showGridOverlay && (
        <GridOverlay element={element} refreshKey={refreshKey} />
      )}

      {/* Box model overlay (M key) */}
      {showBoxModel && (
        <BoxModelOverlay element={element} refreshKey={refreshKey} />
      )}

      {/* Ghosted margin + padding preview — always visible on selection */}
      <SpacingPreviewOverlay element={element} refreshKey={refreshKey} />

      {/* Flex gap overlay — pink dashed hatching between flex children */}
      {isFlexContainer && (
        <FlexGapOverlay element={element} refreshKey={refreshKey} />
      )}

      {/* Spacing guides overlay — full intensity during active scrubbing */}
      <SpacingGuidesOverlay element={element} refreshKey={refreshKey} />
    </>
  );
}
