/**
 * vitest.globalSetup.ts — ensure the panel Tailwind output exists.
 *
 * `pretest` already runs the build script via npm. This setup hook is a
 * second guard for direct `vitest` invocations (e.g. from an IDE) so the
 * `panelTailwind.generated.ts` import never resolves to a 404.
 */

import { buildPanelCss } from "./scripts/build-panel-css.mjs";

export default async function setup() {
  await buildPanelCss();
}
