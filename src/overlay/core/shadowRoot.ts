/**
 * shadowRoot.ts — single host element + open shadow root for the overlay
 * (ADR-0008).
 *
 * `ensureTunerHost()` is idempotent — React strict-mode's double-invocation,
 * HMR remounts, and any subsequent `Tuner` instances all reuse the same
 * host/shadow pair. Returns the portal container that lives INSIDE the
 * shadow root; every `createPortal(…)` call site retargets to this container
 * via the `usePortalTarget()` hook so popovers, modals, and selectors land
 * inside the boundary.
 *
 * Two helpers wrap the only DOM APIs that silently degrade across a shadow
 * boundary: `composedTarget(event)` for retargeted `event.target` reads and
 * `shadowAwareActiveElement()` for `document.activeElement` reads.
 *
 * Inline host styles cover containing-block invariants (`position: fixed`
 * inside the shadow root must resolve against the viewport, not against the
 * host) and the inherited-property reset (so host typography does not bleed
 * into the panel). Tailwind utilities used by panel components are adopted
 * into the shadow root from `panelTailwind.generated.ts`.
 */

import { managedSheet } from "./managedSheet";
import { PANEL_TAILWIND_CSS } from "../../styles/panelTailwind.generated";

const HOST_ATTR = "data-tuner-host";
const PORTAL_CONTAINER_ATTR = "data-tuner-portal-container";

let hostEl: HTMLElement | null = null;
let shadowRootRef: ShadowRoot | null = null;
let portalContainerEl: HTMLElement | null = null;
let stylesheetsAdopted = false;

/**
 * Defensive reset for inherited-only properties (font, color, line-height,
 * direction) plus the design tokens that used to live on `.__tuner-root` in
 * `globals.css`. Non-inherited properties are already covered by the panel's
 * pervasive inline styles, so this sheet stays small.
 *
 * `:host` rules apply to the host element itself; descendants inside the
 * shadow tree inherit via the normal cascade.
 */
const PANEL_CHROME_CSS = `
:host {
  all: initial;
  font-family: system-ui, -apple-system, 'SF Pro Display', sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #171717;
  direction: ltr;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* Pointer-events MUST NOT be 'none' here — it would inherit into the panel
     and disable interactivity. The host has width/height 0 by inline style so
     it never intercepts host-page pointer events on its own. */
}

.__tuner-root {
  --background: #FFFFFF;
  --foreground: #171717;
  --muted: rgba(0, 0, 0, 0.05);
  --muted-foreground: #525252;
  --card: #FFFFFF;
  --card-foreground: #171717;
  --popover: #F5F5F5;
  --popover-foreground: #171717;
  --primary: #3B82F6;
  --primary-foreground: #ffffff;
  --secondary: rgba(0, 0, 0, 0.05);
  --secondary-foreground: #404040;
  --accent: rgba(0, 0, 0, 0.04);
  --accent-foreground: #404040;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: rgba(0, 0, 0, 0.10);
  --input: rgba(0, 0, 0, 0.04);
  --ring: rgba(59, 130, 246, 0.3);
  --radius: 0.125rem;
  --sidebar-background: #FFFFFF;
  --sidebar-foreground: #171717;
  --sidebar-primary: #3B82F6;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: rgba(0, 0, 0, 0.04);
  --sidebar-accent-foreground: #404040;
  --sidebar-border: rgba(0, 0, 0, 0.10);
  --sidebar-ring: rgba(59, 130, 246, 0.3);
  font-family: system-ui, -apple-system, 'SF Pro Display', sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.__tuner-root,
.__tuner-root *,
.__tuner-root *::before,
.__tuner-root *::after {
  box-sizing: border-box;
  margin: 0;
}

.__tuner-root::-webkit-scrollbar { width: 4px; }
.__tuner-root::-webkit-scrollbar-track { background: transparent; }
.__tuner-root::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 2px;
}
.__tuner-root::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

.__tuner-selector-outline {
  animation: __tuner-pulse 1.5s ease-in-out infinite;
}

@keyframes __tuner-pulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3); }
  50% { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); }
}
`;

function applyHostInlineStyles(el: HTMLElement): void {
  // Containing-block invariants (transform/filter/perspective: 'none') must
  // resolve to literal 'none' for getComputedStyle in happy-dom, so set them
  // inline rather than via a sheet. width/height zero keeps the host out of
  // the page's hit-testing while still allowing the portal container inside
  // the shadow tree to draw fixed-position content over the viewport.
  const style = el.style;
  style.position = "fixed";
  style.top = "0";
  style.left = "0";
  style.width = "0";
  style.height = "0";
  style.transform = "none";
  style.filter = "none";
  style.perspective = "none";
  style.contain = "layout style";
}

export function ensureTunerHost(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("ensureTunerHost: no document (called outside the browser).");
  }
  if (portalContainerEl && hostEl?.isConnected) return portalContainerEl;

  // Reattach if a previous host was detached (HMR / strict-mode mount-unmount).
  if (!hostEl || !hostEl.isConnected) {
    const existing = document.body.querySelector<HTMLElement>(`[${HOST_ATTR}]`);
    if (existing) {
      hostEl = existing;
    } else {
      hostEl = document.createElement("div");
      hostEl.setAttribute(HOST_ATTR, "");
      document.body.appendChild(hostEl);
    }
  }
  applyHostInlineStyles(hostEl);

  if (!shadowRootRef) {
    shadowRootRef = hostEl.shadowRoot ?? hostEl.attachShadow({ mode: "open" });
  }

  if (!portalContainerEl || portalContainerEl.parentNode !== shadowRootRef) {
    const existing = shadowRootRef.querySelector<HTMLElement>(
      `[${PORTAL_CONTAINER_ATTR}]`,
    );
    if (existing) {
      portalContainerEl = existing;
    } else {
      portalContainerEl = document.createElement("div");
      portalContainerEl.setAttribute(PORTAL_CONTAINER_ATTR, "");
      shadowRootRef.appendChild(portalContainerEl);
    }
  }

  if (!stylesheetsAdopted) {
    // Order matters: Tailwind utilities first, then chrome — chrome's
    // inheritance reset on `:host` and the `.__tuner-root` design tokens
    // need to win over preflight defaults that would otherwise inherit.
    managedSheet("panel-tailwind", shadowRootRef).replace(PANEL_TAILWIND_CSS);
    managedSheet("panel-chrome", shadowRootRef).replace(PANEL_CHROME_CSS);
    stylesheetsAdopted = true;
  }

  return portalContainerEl;
}

export function getTunerHost(): HTMLElement | null {
  return hostEl;
}

export function getTunerShadowRoot(): ShadowRoot | null {
  return shadowRootRef;
}

/**
 * Returns the original event target, traversing across an open shadow
 * boundary. For events composed across the shadow root (the only kind that
 * actually leave it), `composedPath()[0]` is the real target; for synthetic
 * events that never crossed, falls back to `event.target`.
 */
export function composedTarget(event: Event): Element | null {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  const first = path[0];
  if (first instanceof Element) return first;
  const target = event.target;
  return target instanceof Element ? target : null;
}

/**
 * Returns the focused element. When focus is inside the shadow root, the host
 * page sees `document.activeElement === host`; this helper unwraps that to
 * the actual focused descendant via `shadowRoot.activeElement`.
 */
export function shadowAwareActiveElement(): Element | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (active && hostEl && active === hostEl) {
    return shadowRootRef?.activeElement ?? hostEl;
  }
  return active;
}

/** Test-only: tear the host singleton back down so the next call rebuilds. */
export function _resetTunerHostForTests(): void {
  if (shadowRootRef && portalContainerEl) {
    managedSheet("panel-tailwind", shadowRootRef).dispose();
    managedSheet("panel-chrome", shadowRootRef).dispose();
  }
  if (hostEl?.parentNode) hostEl.parentNode.removeChild(hostEl);
  hostEl = null;
  shadowRootRef = null;
  portalContainerEl = null;
  stylesheetsAdopted = false;
}
