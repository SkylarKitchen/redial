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
