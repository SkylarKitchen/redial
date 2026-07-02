/**
 * server/index.ts — Next.js App Router route handler
 *
 * Usage: User creates app/api/tuner/[...path]/route.ts with:
 *   export { GET, POST } from "redial/server";
 *
 * The catch-all mount serves two POST routes, dispatched on the pathname:
 *   - .../commit       (default) — CSS / Tailwind source-file commits
 *   - .../open-editor  — open a source file in the developer's editor
 *     (issue #82: the Header's source-file link posts { file, line } here)
 *
 * Uses standard Web API Request/Response to avoid type conflicts
 * when the host app has a different version of Next.js.
 */

import { spawn } from "node:child_process";
import { basename } from "node:path";
import { handleCommit, type CommitChange } from "./commit";
import { handleTailwindCommit, type TailwindChange } from "./commitTailwind";
import { isRealPathWithinRoot, resolveSafe } from "./pathSafety";
import { REDIAL_MARKER_HEADER } from "../lib/protocol";

/**
 * Shape-check one Tailwind batch element before it reaches
 * handleTailwindCommit, which dereferences fields ahead of its try/catch —
 * a null/non-object element would otherwise TypeError into a batch-wide 500
 * (issue #65). sourceFile is optional at runtime (the handler falls back to
 * a className search), but must be a string when present.
 */
function isWellFormedTailwindChange(change: unknown): change is TailwindChange {
  if (typeof change !== "object" || change === null || Array.isArray(change)) {
    return false;
  }
  const c = change as Record<string, unknown>;
  return (
    typeof c.existingClasses === "string" &&
    typeof c.newClasses === "string" &&
    (c.sourceFile === undefined || typeof c.sourceFile === "string")
  );
}

// ---------------------------------------------------------------------------
// Open-in-editor (issue #82)
// ---------------------------------------------------------------------------

type LaunchEditor = (file: string, line: number) => Promise<void>;

/**
 * Pick the editor command + argv for opening `file` at `line`.
 *
 * The command comes from the developer's OWN environment
 * ($REDIAL_EDITOR → $REACT_EDITOR → $VISUAL → $EDITOR, defaulting to VS
 * Code's `code`), so splitting it on whitespace is trusted-input handling.
 * The request-controlled `file` is always passed as a discrete argv element
 * and no shell is ever involved (spawn without `shell: true`), so the
 * payload cannot inject commands.
 */
function editorCommand(file: string, line: number): { cmd: string; args: string[] } {
  const raw =
    process.env.REDIAL_EDITOR ||
    process.env.REACT_EDITOR ||
    process.env.VISUAL ||
    process.env.EDITOR ||
    "code";
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0];
  const extra = parts.slice(1);
  const bin = basename(cmd).toLowerCase().replace(/\.(exe|cmd|bat)$/, "");

  // VS Code family: `code -g file:line`
  if (["code", "code-insiders", "codium", "vscodium", "cursor", "windsurf"].includes(bin)) {
    return { cmd, args: [...extra, "-g", `${file}:${line}`] };
  }
  // Sublime / Zed style: `subl file:line`
  if (["subl", "sublime_text", "zed"].includes(bin)) {
    return { cmd, args: [...extra, `${file}:${line}`] };
  }
  // vi/emacs style: `+line file`
  if (["vim", "nvim", "vi", "gvim", "mvim", "emacs", "emacsclient", "kak", "nano", "micro", "helix", "hx"].includes(bin)) {
    return { cmd, args: [...extra, `+${line}`, file] };
  }
  return { cmd, args: [...extra, file] };
}

const defaultLaunchEditor: LaunchEditor = (file, line) => {
  const { cmd, args } = editorCommand(file, line);
  return new Promise<void>((resolvePromise, rejectPromise) => {
    // shell stays false (the default): argv goes straight to exec, so the
    // request body can never be interpolated into a shell string.
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.once("error", rejectPromise);
    child.once("spawn", () => {
      child.unref();
      resolvePromise();
    });
  });
};

let launchEditorImpl: LaunchEditor = defaultLaunchEditor;

/**
 * Test seam: swap out the editor-launch side effect so route tests never
 * spawn a real editor. Pass null to restore the default launcher.
 */
export function __setLaunchEditorForTests(fn: LaunchEditor | null): void {
  launchEditorImpl = fn ?? defaultLaunchEditor;
}

/**
 * POST .../open-editor — body { file: string, line?: number }.
 *
 * Path safety mirrors the commit pipeline: resolveSafe() rejects traversal
 * at the string level, then isRealPathWithinRoot() resolves symlinks and
 * doubles as the existence check — only a real file inside the project root
 * ever reaches the editor.
 */
async function handleOpenEditor(body: unknown): Promise<Response> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json(
      { error: "expected { file: string, line?: number }" },
      { status: 400 }
    );
  }
  const { file, line: rawLine } = body as { file?: unknown; line?: unknown };
  if (typeof file !== "string" || file.length === 0) {
    return Response.json(
      { error: "expected { file: string, line?: number }" },
      { status: 400 }
    );
  }
  const line =
    typeof rawLine === "number" && Number.isFinite(rawLine) && rawLine >= 1
      ? Math.floor(rawLine)
      : 1;

  const projectRoot = process.cwd();
  let resolved: string;
  try {
    resolved = resolveSafe(projectRoot, file);
  } catch {
    return Response.json(
      { error: "path outside project root rejected" },
      { status: 403 }
    );
  }
  if (!(await isRealPathWithinRoot(resolved, projectRoot))) {
    return Response.json(
      { error: "file not found (or resolves outside the project root)" },
      { status: 404 }
    );
  }

  try {
    await launchEditorImpl(resolved, line);
    return Response.json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: `could not launch editor (${detail}) — set $REDIAL_EDITOR, $REACT_EDITOR, or $EDITOR to your editor command`,
      },
      { status: 500 }
    );
  }
}

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

    // Route on the catch-all pathname: .../open-editor opens a source file
    // in the developer's editor (issue #82); everything else is a commit.
    let pathname = "";
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      // Unparseable URL — fall through to commit handling.
    }
    if (pathname.endsWith("/open-editor")) {
      return await handleOpenEditor(body);
    }

    // Route Tailwind commits to dedicated handler
    if (body.mode === "tailwind") {
      const changes: unknown[] = body.changes;
      if (!Array.isArray(changes)) {
        return Response.json(
          { error: "expected { changes: [...] }" },
          { status: 400 }
        );
      }
      // Issue #65: partition malformed elements into per-item failures
      // instead of letting them crash the whole batch.
      const wellFormed: TailwindChange[] = [];
      const malformed: unknown[] = [];
      for (const change of changes) {
        if (isWellFormedTailwindChange(change)) wellFormed.push(change);
        else malformed.push(change);
      }
      const result = await handleTailwindCommit(wellFormed);
      for (const change of malformed) {
        result.failed.push({
          sourceFile: "",
          existingClasses: "",
          newClasses: "",
          ...(typeof change === "object" && change !== null && !Array.isArray(change)
            ? change
            : {}),
          reason:
            "malformed change entry — expected an object with string existingClasses/newClasses fields",
        });
      }
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

/**
 * GET — save-endpoint health check (audit: opaque first-save failures).
 *
 * The overlay's Footer pings this once per session on mount to verify the
 * catch-all route is actually mounted BEFORE the user invests edits and hits
 * Save. `ok`/`version` are the machine-checked fields (the client validates
 * shape, not just reachability — a 200 from some coincidental route must not
 * count as healthy); `status` is the legacy field kept for anything already
 * reading it.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "not available in production" }, { status: 404 });
  }

  return Response.json({ ok: true, version: 1, status: "tuner server active" });
}
