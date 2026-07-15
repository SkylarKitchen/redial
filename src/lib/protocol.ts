/**
 * protocol.ts — shared client/server constants for the commit endpoint.
 *
 * Like css.ts, this is imported from both the overlay (browser) and the
 * route handler (Node) so the two sides cannot drift apart.
 */

/**
 * Marker header every overlay request to the commit endpoint must carry.
 * A custom header makes a cross-origin request non-"simple", forcing a CORS
 * preflight that the dev server never approves — so an arbitrary page the
 * developer happens to visit cannot blind-POST source-file mutations while
 * `next dev` is running (issue #54).
 */
export const REDIAL_MARKER_HEADER = "x-redial";

// ─── Commit wire contract ────────────────────────────────────────────────────
// The change/result shapes below ARE the wire: the overlay enriches into them
// and the route handler consumes them. They used to live as hand-maintained
// twins (commitUtils.EnrichedChange vs server CommitChange, plus a third
// private SaveResult in Footer) — single-sourced here so the sides cannot
// drift (same rationale as REDIAL_MARKER_HEADER above).

/** JSX disambiguation anchors shared by `createClass` and `elementScope`:
 *  the fiber-resolved source location plus the element's class string as it
 *  exists in SOURCE (session-attached classes and tuner chrome excluded). */
export type JsxAnchors = {
  jsxSourceFile?: string;
  jsxSourceLine?: number;
  existingClasses?: string;
};

export type CommitChange = {
  prop: string;
  from: string;
  to: string;
  sourceFile?: string;
  sourceLine?: number;
  className?: string;
  componentName?: string;
  /** CSS pseudo-class state (e.g. "hover", "focus"). When set, targets
   *  the `.className:state { }` block instead of the base class block. */
  state?: string;
  /** Compiled CSS href for source map resolution (e.g. "/_next/static/css/abc.css") */
  cssHref?: string;
  /**
   * Class-creation descriptor (audit 05 — the Webflow "type a class name"
   * flow). When present, the server (a) appends a `.name { }` rule block to
   * the resolved stylesheet if the class has no rule there yet, and (b)
   * attaches the class token to the JSX source's className attribute
   * (commitTailwind.attachClassToJSX). `existingClasses` is the element's
   * class string BEFORE the session attach — the JSX disambiguation anchor.
   */
  createClass?: { name: string } & JsxAnchors;
  /**
   * Element-scope persistence descriptor (audit 06 — element scope previews on
   * ONE element, so it must save to that one element). When present, the
   * change is merged into the element's JSX `style` attribute at the
   * fiber-resolved location (`applyInlineStyleToJSX`, same anchors createClass
   * uses) and is NEVER routed into a CSS rule — even when the payload also
   * carries `sourceFile`/`className`. An unresolvable anchor is an accurate
   * per-item failure, not a fallback to the shared class rule.
   */
  elementScope?: JsxAnchors;
  /**
   * Responsive breakpoint (issue #53). When present, the change targets the
   * `@media (min-width: <minWidth>px)` block instead of the base rule:
   * locate a matching block containing a rule for `className` and
   * replace/insert the declaration there; create the rule inside a matching
   * block that lacks it; append a whole new block at EOF when no block
   * matches. Condition matching tolerates spacing variants and em/rem
   * equivalents (×16); NEW blocks are always written in the px form.
   */
  breakpoint?: {
    /** Engine breakpoint id (informational — the write keys off minWidth). */
    id?: string;
    /** min-width in px. Positive finite number. */
    minWidth: number;
  };
  /**
   * Theme-mode defining selector (issue #53, second half). When present, the
   * change is a CSS-variable mode override: `prop` (a custom property) is
   * written inside the top-level rule block whose selector text matches —
   * find-or-REFUSE. A missing block is a per-item failure (the client keeps
   * its clipboard side-channel); the change never falls through to the
   * base/variable search, which would happily land the value in `:root` or a
   * sibling mode's block. Mutually exclusive with `breakpoint` and `state`:
   * modes are their own override dimension.
   */
  modeSelector?: string;
};

export type TailwindChange = {
  sourceFile: string;
  sourceLine?: number;
  existingClasses: string;
  newClasses: string;
};

export type CommitResult = {
  written: string[];
  failed: Array<CommitChange & { reason: string }>;
};

export type TailwindCommitResult = {
  written: string[];
  failed: Array<TailwindChange & { reason: string }>;
};
