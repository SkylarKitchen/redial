/**
 * OverlayStyles.tsx — global <style> tags for the tuner panel chrome
 *
 * Extracted verbatim from Overlay.tsx's render tree. These are static (theme-token
 * driven) stylesheets with no props/state, so hoisting them out of the Overlay
 * component is behavior-identical and removes ~100 lines of inline CSS from the
 * orchestrator.
 *
 *   - OverlayScrollbarStyles: thin auto-hiding scrollbars + custom range-input thumb.
 *   - ReducedMotionStyles: kills transitions/animations when the user prefers it.
 */

import { ms } from "../timing";
import { color, surface, blackAlpha, primaryAlpha } from "../theme";

/** Scrollbar + slider-thumb styling, scoped to the `.__tuner-root` subtree. */
export function OverlayScrollbarStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
        .__tuner-root::-webkit-scrollbar,
        .__tuner-root *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .__tuner-root::-webkit-scrollbar-track,
        .__tuner-root *::-webkit-scrollbar-track {
          background: transparent;
        }
        .__tuner-root::-webkit-scrollbar-thumb,
        .__tuner-root *::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0);
          border-radius: 4px;
          transition: background ${ms("slow")};
        }
        .__tuner-root.is-scrolling::-webkit-scrollbar-thumb,
        .__tuner-root:hover::-webkit-scrollbar-thumb,
        .__tuner-root *:hover::-webkit-scrollbar-thumb {
          background: ${surface.track};
        }
        .__tuner-root.is-scrolling::-webkit-scrollbar-thumb:hover,
        .__tuner-root:hover::-webkit-scrollbar-thumb:hover,
        .__tuner-root *:hover::-webkit-scrollbar-thumb:hover {
          background: ${blackAlpha(0.2)};
        }
        .__tuner-root,
        .__tuner-root *:not([data-radix-scroll-area-viewport]) {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .__tuner-root.is-scrolling,
        .__tuner-root:hover,
        .__tuner-root *:not([data-radix-scroll-area-viewport]):hover {
          scrollbar-color: ${surface.track} transparent;
        }
        /* Slider thumb styling — replaces browser defaults with light-theme matching thumb */
        .__tuner-root input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        .__tuner-root input[type="range"]::-webkit-slider-runnable-track {
          height: 3px;
          background: rgba(0,0,0,0.08);
          border-radius: 2px;
          transition: background ${ms("expand")};
        }
        .__tuner-root input[type="range"]:hover::-webkit-slider-runnable-track {
          background: rgba(0,0,0,0.15);
        }
        .__tuner-root input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${color.primary};
          border: 2px solid ${color.background};
          box-shadow: 0 0 3px rgba(0,0,0,0.15);
          margin-top: -4.5px;
          transition: transform ${ms("fast")}, box-shadow ${ms("fast")};
        }
        .__tuner-root input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 0 3px ${primaryAlpha(0.25)};
        }
        .__tuner-root input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(1.1);
          background: ${color.primaryActive};
        }
        .__tuner-root input[type="range"]::-moz-range-track {
          height: 3px;
          background: rgba(0,0,0,0.08);
          border-radius: 2px;
          transition: background ${ms("expand")};
        }
        .__tuner-root input[type="range"]:hover::-moz-range-track {
          background: rgba(0,0,0,0.15);
        }
        .__tuner-root input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${color.primary};
          border: 2px solid ${color.background};
          box-shadow: 0 0 3px rgba(0,0,0,0.15);
          transition: transform ${ms("fast")}, box-shadow ${ms("fast")};
        }
        .__tuner-root input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 0 3px ${primaryAlpha(0.25)};
        }
        .__tuner-root input[type="range"]::-moz-range-thumb:active {
          transform: scale(1.1);
          background: ${color.primaryActive};
        }
      `}} />
  );
}

/** Disables transitions/animations inside the panel when reduced motion is preferred. */
export function ReducedMotionStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
              .__tuner-root *, .__tuner-root *::before, .__tuner-root *::after {
                transition-duration: 0s !important;
                animation-duration: 0s !important;
              }
            `}} />
  );
}
