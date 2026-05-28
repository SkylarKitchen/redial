/**
 * Default sandcastle entry — one agent run, prompt sourced from
 * `.sandcastle/prompt.md` (or the `PROMPT` env var if set).
 *
 * Usage:
 *   npm run sandcastle                              # uses prompt.md as-is
 *   PROMPT="Fix issue #42 …" npm run sandcastle      # ad-hoc prompt
 *   SANDCASTLE_MODEL=claude-opus-4-5 npm run sandcastle
 *
 * Credentials (Claude subscription, no API key):
 *   1. Generate a long-lived OAuth token on the host:
 *        claude setup-token
 *   2. Put it in `.sandcastle/.env` (gitignored):
 *        CLAUDE_CODE_OAUTH_TOKEN=<token>
 *   Sandcastle's env resolver injects every key declared in
 *   `.sandcastle/.env` into the sandbox, so the containerized agent
 *   authenticates with your subscription. (Bind-mounting `~/.claude`
 *   does NOT work on macOS — the token lives in the Keychain, not the dir.)
 *
 * If you'd rather use an API key, set ANTHROPIC_API_KEY in `.sandcastle/.env`
 * instead.
 *
 * For batch / parallel runs over a markdown checklist, use the host runner:
 *   npm run tasks tasks.md --workers 5
 */
import { existsSync, readFileSync } from "node:fs";
import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// Load `.sandcastle/.env` (gitignored) so you can pin SANDCASTLE_MODEL etc.
// locally without committing them.
const ENV_FILE = ".sandcastle/.env";
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const MODEL = process.env.SANDCASTLE_MODEL ?? "claude-opus-4-5";
const PROMPT = process.env.PROMPT;

const result = await run({
  agent: claudeCode(MODEL),
  sandbox: docker({
    imageName: process.env.SANDCASTLE_IMAGE ?? "redial-sandcastle:local",
    mounts: [
      // Reuse the host's npm cache so first-run `npm ci` is fast.
      { hostPath: "~/.npm", sandboxPath: "/home/agent/.npm" },
    ],
  }),
  ...(PROMPT ? { prompt: PROMPT } : { promptFile: ".sandcastle/prompt.md" }),
  // Edits land on a temp branch and merge back to HEAD on success.
  // Swap to { type: "branch", branch: "agent/<name>" } to keep changes on
  // a dedicated branch for review before merging.
  branchStrategy: { type: "merge-to-head" },
  hooks: {
    sandbox: {
      onSandboxReady: [
        { command: "npm ci", timeoutMs: 10 * 60_000 },
      ],
    },
  },
});

console.log(result);

