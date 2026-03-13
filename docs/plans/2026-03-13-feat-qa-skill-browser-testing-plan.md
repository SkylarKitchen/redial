---
title: "feat: /qa skill — Automated browser QA for Redial panel"
type: feat
date: 2026-03-13
---

# `/qa` Skill — Automated Browser QA for Redial Panel

## Overview

Create a `/qa` skill that uses Claude-in-Chrome to systematically interact with the live Redial panel, detect UX issues, and auto-fix them (write test → fix → verify → commit). The panel has 50+ interactive controls across 8 CSS sections with zero browser-level testing coverage.

## Problem Statement

The existing 1,534 Vitest unit tests cover logic (apply, infer, parsers) but can't catch visual/interaction bugs like:
- Selecting a control value and being unable to reset/deselect it
- Content overflowing containers
- Stuck hover states, dropdowns not dismissing
- Focus rings missing, keyboard navigation broken

## Deliverables

| File | Action | Description |
|------|--------|-------------|
| `.claude/skills/qa.md` | **Create** | Skill definition following polish/harden conventions |
| `QA_CHECKLIST.md` | **Create** | Structured test matrix with checkable items by scope |

## Acceptance Criteria

- [ ] `.claude/skills/qa.md` — frontmatter with `name: qa`, `description`, `user_invocable: true`
- [ ] `.claude/skills/qa.md` — step-by-step process (preflight → browser → test → fix → commit → update)
- [ ] `.claude/skills/qa.md` — rules section matching polish/harden conventions
- [ ] `.claude/skills/qa.md` — scope selection: `resets`, `overflow`, `visual`, `keyboard`
- [ ] `QA_CHECKLIST.md` — 4 scope sections with specific interaction items
- [ ] `QA_CHECKLIST.md` — each item specifies interaction + expected behavior
- [ ] Skill uses Claude-in-Chrome tools (navigate, computer, javascript_tool, read_page, read_console_messages)
- [ ] Skill follows test-first workflow: write failing test → fix → verify
- [ ] Skill resets panel state between test groups

## Scope Per Invocation

| Scope | Trigger | Tests |
|-------|---------|-------|
| `resets` | `/qa resets` (default) | Control modify + Alt+click reset, Footer reset, section memory, scope pills |
| `overflow` | `/qa overflow` | Text clipping, portal rendering, long values, viewport bounds |
| `visual` | `/qa visual` | Hover states, transitions, token colors, alignment |
| `keyboard` | `/qa keyboard` | Tab navigation, Escape closes, focus rings, ARIA labels |

## Technical Approach

### Chrome Interaction Pattern
1. `navigate` → `http://localhost:3000/demo`
2. `computer` → click, type, hover, Tab, Escape
3. `javascript_tool` → DOM inspection (overflow, focus, ARIA, portal checks)
4. `read_page` → screenshot for visual verification
5. `read_console_messages` → catch React warnings/errors

### Panel Reset Between Tests
1. Escape to close popups
2. Footer Reset button to clear overrides
3. Reload page if needed

### Auto-Fix Loop
For each found issue:
1. Write failing Vitest test (happy-dom)
2. Implement minimal fix (theme tokens, timing tokens, inline styles)
3. `npm run typecheck` + `npm test`
4. Commit with `fix:` prefix

## References

- Skill conventions: `.claude/skills/polish.md`, `.claude/skills/harden.md`
- Panel source: `src/overlay/WebflowPanel.tsx`, `src/overlay/controls.tsx`
- Design tokens: `src/overlay/theme.ts`, `src/overlay/timing.ts`
- Demo page: `test-app/app/demo/page.tsx`
- Full spec: `webflow-style-panel-spec.md`
