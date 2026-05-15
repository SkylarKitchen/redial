# Redial Glossary

Canonical vocabulary for Redial. Terms are resolved here when they get sharpened in design conversations. Implementation details belong in code or ADRs, not here.

---

## must-ship

An item required to release **v1.0**. An item qualifies if it meets at least one of:

- **first-run breakage** — a fresh `npm install github:SkylarKitchen/redial` user hits it within their first ten minutes of use,
- **correctness or security bug** — produces wrong output, corrupts a source file, or has a real security impact,
- **public embarrassment** — visibly broken to anyone reading the repo (broken README example, dead reference in the showcase, contradictory docs).

An item does **not** qualify as `must-ship` solely on the basis of:

- performance,
- architecture or refactoring (e.g. shadcn removal, Shadow DOM isolation, file decomposition),
- test-coverage gaps that don't hide a known bug,
- polish, token consistency, or focus-ring uniformity,
- "better UX" smoothing of already-working flows.

Everything that fails the rubric is either `nice-to-have` (kept) or `wontfix` (rejected) — see those terms.

## nice-to-have

A backlog item we want to keep but defer past v1.0. Lives as an **open GitHub Issue** carrying the `nice-to-have` and `post-v1` labels, with a state label from the canonical triage vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`). Does not live in an in-repo `.md` backlog. Milestones are not used for the v1 boundary — labels are the canonical cohort primitive here.

## wontfix

A backlog item we have considered and decided not to do. Two dispositions:

- **filed and closed with `wontfix`** — used when the decision has signal value (someone is likely to raise it again, or the rationale is non-obvious). Provides a searchable paper trail.
- **deleted outright** — used when the item has no future signal value (e.g. items that were polish-only and already obsolete). Git history is sufficient record.

The choice between the two is per-item judgment, not a category rule.

## Ship Blocker

> ⚠️ **Deprecated.** Pre-dates the `must-ship` rubric. `AUDIT_BACKLOG.md` uses this label under an older, fuzzier definition that conflated architectural improvements with release-gating bugs. When reading existing docs, treat the "Ship Blocker" label as a *suggestion to re-triage under the current rubric*, not as evidence the item gates v1.0.
