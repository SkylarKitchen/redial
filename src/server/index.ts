/**
 * server/index.ts — Next.js App Router route handler
 *
 * Usage: User creates app/api/tuner/[...path]/route.ts with:
 *   export { GET, POST } from "redial/server";
 *
 * Uses standard Web API Request/Response to avoid type conflicts
 * when the host app has a different version of Next.js.
 */

import { handleCommit, type CommitChange } from "./commit";
import { handleTailwindCommit, type TailwindChange } from "./commitTailwind";
import { REDIAL_MARKER_HEADER } from "../lib/protocol";

export async function POST(request: Request) {
  // Dev-mode guard
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "not available in production" }, { status: 404 });
  }

  // CSRF guard (issue #54). request.json() parses regardless of Content-Type,
  // so a text/plain "simple request" needs no preflight: while `next dev`
  // runs, any page the developer visits could otherwise POST here and mutate
  // source files. Browsers attach Origin to cross-origin POSTs — when present
  // it must match the request's Host.
  const origin = request.headers.get("origin");
  if (origin !== null) {
    const host = request.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // Unparseable or opaque ("null") Origin — treat as cross-origin.
    }
    if (!host || originHost !== host) {
      return Response.json(
        { error: "cross-origin request rejected" },
        { status: 403 }
      );
    }
  }
  // The overlay always sends this marker. A custom header makes a cross-origin
  // request non-"simple", forcing a CORS preflight that never gets approved.
  if (!request.headers.get(REDIAL_MARKER_HEADER)) {
    return Response.json(
      { error: `missing ${REDIAL_MARKER_HEADER} header` },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    // Route Tailwind commits to dedicated handler
    if (body.mode === "tailwind") {
      const changes: TailwindChange[] = body.changes;
      if (!Array.isArray(changes)) {
        return Response.json(
          { error: "expected { changes: [...] }" },
          { status: 400 }
        );
      }
      const result = await handleTailwindCommit(changes);
      return Response.json(result);
    }

    // Default: CSS commit
    const changes: CommitChange[] = body.changes;

    if (!Array.isArray(changes)) {
      return Response.json(
        { error: "expected { changes: [...] }" },
        { status: 400 }
      );
    }

    const result = await handleCommit(changes);
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "not available in production" }, { status: 404 });
  }

  return Response.json({ status: "tuner server active" });
}
