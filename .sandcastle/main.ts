/**
 * Default sandcastle entry — one agent run, prompt sourced from
 * `.sandcastle/prompt.md` (or the `PROMPT` env var if set).
 *
 * Usage:
 *   npm run sandcastle                              # uses prompt.md as-is
 *   PROMPT="Fix issue #42 …" npm run sandcastle      # ad-hoc prompt
 *   SANDCASTLE_MODEL=claude-opus-4-5 npm run sandcastle
 *
 * For batch / parallel runs over a markdown checklist, use the host runner:
 *   npm run tasks tasks.md --workers 5
 */
import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

const MODEL = process.env.SANDCASTLE_MODEL ?? "claude-sonnet-4-5";
const PROMPT = process.env.PROMPT;

const result = await run({
  agent: claudeCode(MODEL),
  sandbox: docker({ imageName: "redial-sandcastle:local" }),
  ...(PROMPT ? { prompt: PROMPT } : { promptFile: ".sandcastle/prompt.md" }),
  // Edits land on a temp branch and merge back to HEAD on success.
  // Swap to { type: "branch", branch: "agent/<name>" } to keep changes on
  // a dedicated branch for review before merging.
  branchStrategy: { type: "merge-to-head" },
  hooks: {
    sandbox: {
      onSandboxReady: [
        // Install deps once the worktree is mounted. Host `~/.npm` cache is
        // bind-mounted (see Dockerfile + docs/sandcastle.md) so this is fast
        // on subsequent runs.
        { command: "npm ci", timeoutMs: 10 * 60_000 },
      ],
    },
  },
});

console.log(result);
