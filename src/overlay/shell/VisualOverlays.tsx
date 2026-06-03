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
  isGridContainer: boolean;
  isFlexContainer: boolean;
  showGridOverlay: boolean;
  showBoxModel: boolean;
}

export function VisualOverlays({
  element,
  isGridContainer,
  isFlexContainer,
  showGridOverlay,
  showBoxModel,
}: VisualOverlaysProps) {
  return (
    <>
      {/* Grid overlay (only when selected element is a grid container and overlay is enabled) */}
      {isGridContainer && showGridOverlay && (
        <GridOverlay element={element} />
      )}

      {/* Box model overlay (M key) */}
      {showBoxModel && (
        <BoxModelOverlay element={element} />
      )}

      {/* Ghosted margin + padding preview — always visible on selection */}
      <SpacingPreviewOverlay element={element} />

      {/* Flex gap overlay — pink dashed hatching between flex children */}
      {isFlexContainer && (
        <FlexGapOverlay element={element} />
      )}

      {/* Spacing guides overlay — full intensity during active scrubbing */}
      <SpacingGuidesOverlay element={element} />
    </>
  );
}
