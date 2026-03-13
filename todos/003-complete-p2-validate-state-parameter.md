---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, security, state-preview]
dependencies: []
---

# Validate State Parameter Against Allowlist

## Problem Statement
The `state` parameter in `statePreview.ts` is interpolated directly into CSS selector strings without validation. While the UI constrains selection to 9 hardcoded values, the function itself doesn't validate, leaving a CSS injection vector.

## Findings
- **Source**: Security sentinel
- **Location**: `src/overlay/statePreview.ts` line 98, `src/server/commit.ts` lines 574-584
- **Evidence**: `const selector = \`\${elAttrSelector(el)}.__tuner-state-preview:\${state}\``

## Proposed Solutions

### Option A: Allowlist check at entry points
Add `const VALID_STATES = new Set(["hover", "focus", "active", ...])` and early-return if state is not in the set. Apply in both statePreview.ts and commit.ts.
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] statePreview.ts validates state against allowlist before interpolation
- [ ] commit.ts validates state against allowlist before interpolation
- [ ] Invalid state values are silently rejected
