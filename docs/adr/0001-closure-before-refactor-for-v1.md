# ADR-0001: Closure-before-refactor for v1.0

**Status:** Accepted
**Date:** 2026-05-15

## Context

Redial is feature-complete. Five parallel `.md` backlogs (`AUDIT_BACKLOG.md`, `UI_POLISH.md`, `QA_CHECKLIST.md`, `docs/2026-03-13-prd-remaining-gaps.md`, `todos/`) have accumulated, plus an architecture RFC (Unified Style Engine, issue #14). `AUDIT_BACKLOG.md` labels several architectural rewrites — removing shadcn/ui from ~30 files, Shadow DOM isolation, decomposing the 1,825-line `Overlay.tsx` — as **Ship Blockers** under an older, fuzzier definition that conflated "should eventually do" with "must do before release."

Treating those as literal ship blockers would push v1.0 weeks-to-months out and risks the project never finishing.

## Decision

For v1.0, **architectural refactors are explicitly not ship-gating**. The `must-ship` rubric (see `CONTEXT.md`) admits an item only if it is one of:

- first-run breakage,
- a correctness or security bug,
- public embarrassment.

Performance, architecture, refactoring, test-coverage gaps, polish, and UX-smoothing of working flows are categorically excluded from `must-ship`.

The existing "Ship Blocker" label in `AUDIT_BACKLOG.md` is deprecated; items wearing it must be re-triaged under the current rubric and most will become `nice-to-have` or `wontfix`.

## Consequences

**Accepted costs at v1.0:**

- `Overlay.tsx` ships at ~1,825 lines.
- `apply.ts` ships at ~1,118 lines.
- shadcn/`@/lib/utils` dependencies remain present where they exist.
- Panel renders into host DOM (no Shadow DOM isolation).
- Bundle is eagerly loaded; lazy-loading is a *recommendation* in the README, not enforced internally.
- Unified Style Engine (#14) is post-v1.

**What this enables:**

- A finite, defensible v1.0 bar that can actually be hit.
- Each deferred refactor becomes a `nice-to-have` issue under the `v1.0` milestone (used as the "deferred from v1" cohort), preserving the work to do but not blocking the tag.
- Future architectural work runs against a stable v1 baseline rather than a moving target.

## Alternatives considered

- **Refactor-before-ship.** The implicit default of the original audit. Rejected because it makes v1.0 indefinite — every refactor surfaces dependencies on other refactors.
- **Ship-and-never-refactor.** Cut v1.0 today, treat backlogs as a public roadmap, do no further architecture work. Rejected because the architectural debt is real and degrades the next phase of work; deferring is not the same as discarding.
- **Hybrid by item.** Pick a subset of architectural items as "actually ship-blocking" case by case. Rejected because that recreates the original fuzziness; per-item judgment with no rubric is what produced AUDIT_BACKLOG in the first place.

## Related

- `CONTEXT.md` — `must-ship`, `nice-to-have`, `wontfix`, deprecation of "Ship Blocker".
- GitHub issue #14 — Unified Style Engine RFC (post-v1).
- `AUDIT_BACKLOG.md` — items now subject to re-triage.
