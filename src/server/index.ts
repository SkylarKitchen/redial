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

export async function POST(request: Request) {
  // Dev-mode guard
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "not available in production" }, { status: 404 });
  }

  try {
    const body = await request.json();
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
