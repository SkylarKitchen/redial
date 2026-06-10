/**
 * usePortalTarget.ts — every overlay `createPortal(…)` call routes through
 * here so popovers, modals, and the selection chrome land inside the shadow
 * root (ADR-0008).
 *
 * Falls back to `document.body` when no provider wraps the tree. Most
 * component-level tests mount in isolation without the `ShadowMount` wrapper,
 * so that fallback keeps their existing `parentElement === document.body`
 * assertions intact; production always renders inside the provider.
 */

import { createContext, useContext } from "react";

export const PortalTargetContext = createContext<Element | null>(null);

export function usePortalTarget(): Element {
  const ctx = useContext(PortalTargetContext);
  if (ctx) return ctx;
  if (typeof document === "undefined") {
    throw new Error("usePortalTarget: no document (SSR).");
  }
  return document.body;
}
