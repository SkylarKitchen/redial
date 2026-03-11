/**
 * hmr.ts — unified HMR listener for Turbopack, Vite, and webpack
 *
 * Returns a cleanup function, or null if no HMR runtime was detected.
 * The callback is debounced (100ms) to avoid rapid-fire reconciliation
 * when HMR batches multiple file updates.
 */

export function onHmrUpdate(callback: () => void): (() => void) | null {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(callback, 100);
  };

  // --- Turbopack / Vite (import.meta.hot) ---
  if (typeof import.meta !== "undefined" && import.meta.hot) {
    const hot = import.meta.hot;
    // Turbopack fires "turbopack:afterUpdate", Vite fires "vite:afterUpdate"
    hot.on("turbopack:afterUpdate", debounced);
    hot.on("vite:afterUpdate", debounced);

    return () => {
      if (timer) clearTimeout(timer);
      hot.off?.("turbopack:afterUpdate", debounced);
      hot.off?.("vite:afterUpdate", debounced);
    };
  }

  // --- webpack (module.hot) ---
  if (typeof module !== "undefined" && (module as any).hot) {
    const hot = (module as any).hot;
    const handler = (status: string) => {
      if (status === "idle") debounced();
    };
    hot.addStatusHandler(handler);

    return () => {
      if (timer) clearTimeout(timer);
      // webpack doesn't expose removeStatusHandler on all versions,
      // but the handler is lightweight so this is fine as best-effort
      hot.removeStatusHandler?.(handler);
    };
  }

  return null;
}
