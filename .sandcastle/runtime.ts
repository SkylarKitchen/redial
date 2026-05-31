/**
 * Shared sandcastle runtime: env bootstrap + sandbox config, used by both the
 * single-run entry (`main.ts`) and the parallel PRD runner
 * (`scripts/run-tasks.ts`). Keeping this in one place means the two
 * entrypoints can't drift on how they authenticate, which model they default
 * to, or how the Docker sandbox is built.
 *
 * Credentials (Claude subscription, no API key):
 *   1. Generate a long-lived OAuth token on the host: `claude setup-token`
 *   2. Put it in `.sandcastle/.env` (gitignored): CLAUDE_CODE_OAUTH_TOKEN=<token>
 *   Sandcastle's env resolver injects every key declared in `.sandcastle/.env`
 *   into the sandbox, so the containerized agent authenticates with your
 *   subscription. (Bind-mounting `~/.claude` does NOT work on macOS — the token
 *   lives in the Keychain, not the dir.) To use an API key instead, set
 *   ANTHROPIC_API_KEY in `.sandcastle/.env`.
 */
import { existsSync, readFileSync } from "node:fs";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

/**
 * Load `.sandcastle/.env` (gitignored) into process.env without overwriting
 * already-set vars, so SANDCASTLE_MODEL etc. can be pinned locally without
 * committing them. Call this once, at the top of an entrypoint, before
 * reading any of the getters below.
 */
export function loadDotEnv(file = ".sandcastle/.env"): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

/** Model passed to claudeCode(). Override via SANDCASTLE_MODEL. */
export const model = (): string =>
  process.env.SANDCASTLE_MODEL ?? "claude-opus-4-5";

/** Docker image name. Override via SANDCASTLE_IMAGE. */
export const imageName = (): string =>
  process.env.SANDCASTLE_IMAGE ?? "redial-sandcastle:local";

/** Host mounts shared by every sandbox (reuse npm cache for fast `npm ci`). */
export const mounts = [{ hostPath: "~/.npm", sandboxPath: "/home/agent/.npm" }];

/** Build the Docker sandbox config shared by both entrypoints. */
export const makeSandbox = () => docker({ imageName: imageName(), mounts });
