---
name: qa
description: Browser-based QA of the Redial panel — opens Chrome, runs systematic interaction tests on one scope from QA_CHECKLIST.md, writes failing tests for bugs found, fixes them, and commits
user_invocable: true
---

# Redial QA — Browser-Based UI Testing

You are running one scope of the QA checklist using Chrome browser automation. Your job: open the demo page, systematically test each item in the current scope, write failing tests for bugs, fix them, and commit.

## Prerequisites

Chrome browser tools (Claude-in-Chrome MCP) are **REQUIRED**. If `computer`, `javascript_tool`, `read_page`, and `navigate` are not available, announce this and stop immediately.

## Process

### Step 0: Preflight (Hard Gate)

1. Run `npm run typecheck` — must pass
2. Run `npm test` — capture baseline pass count (note the number)
3. Use `tabs_context_mcp` to get tab context
4. Use `navigate` to open `http://localhost:3000/demo`
5. Wait 2s, then use `javascript_tool` to check: `!!document.querySelector('.__tuner-root')`
6. If not found, dispatch `tuner:select` manually via `javascript_tool`:
   ```javascript
   document.dispatchEvent(new CustomEvent('tuner:select', { detail: document.querySelector('[data-tuner-demo]') }));
   ```
7. Wait 2s, check again. If still not found after 3 attempts: abort with "Panel did not open. Start dev server with `cd test-app && npm run dev`"

### Step 1: Read the Checklist

Read `QA_CHECKLIST.md` and find the first scope with unchecked `[ ]` items. If an argument was passed (e.g., `/qa overflow`), use that scope instead. If all items checked, announce "All QA items complete!" and stop.

Scopes in order:
1. **Resets** — controls can be modified AND reset
2. **Overflow** — no content clips, dropdowns not cut off
3. **Visual** — hover states, transitions, alignment, indicators
4. **Keyboard** — Tab, Escape, focus rings, ARIA

### Step 2: Test Each Item in the Scope

For each unchecked item:

**a) Locate the control**
- Use `read_page` (filter: "interactive") to find the control
- For controls in collapsed sections, expand the section first by clicking the section header
- Use ref-based clicks from `read_page` ref IDs when possible (more reliable than coordinates)

**b) Perform the interaction**
- Use `computer` tool for clicks, drags, keyboard input
- Use `javascript_tool` for programmatic state checks

**c) Check the result**
- Use `javascript_tool` to inspect DOM state (computed styles, attribute values)
- Use `read_console_messages` to check for React errors
- For visual issues, take screenshots with `computer` tool

**d) Record the result**
- PASS: note it, move to next item
- FAIL: note the exact issue (expected vs actual), proceed to fix workflow

### Step 3: Fix Workflow (for each issue found)

**3a. Write a failing test**
- Create test in `src/overlay/__tests__/qa-{scope}.test.ts`
- Use existing patterns: `reset-audit.test.ts` for source-level audits, happy-dom for behavioral tests
- The test MUST fail before your fix
- Use `// @vitest-environment happy-dom` header when DOM APIs are needed

**3b. Implement the fix**
- All UI is inline-styled React (no CSS files)
- All colors from `src/overlay/theme.ts` — never hardcode hex
- All timing from `src/overlay/timing.ts` — `ms("fast")`, `springConfig("panelOpen")`, etc.
- Popups inside containers with backdrop-filter/transforms/overflow:hidden — use `createPortal`
- Keep fixes minimal and surgical

**3c. Verify**
1. `npm run typecheck` — must pass
2. `npm test` — new test must pass, existing tests must not break
3. Compare test count against baseline — if a previously-passing test now fails:
   - Attempt to fix the regression (2 tries max)
   - If that fails: `git checkout -- <changed files>`, mark item as `[SKIPPED: fix caused regression]`
4. Re-test in Chrome — the original interaction should now work

**3d. Commit**
```
git add <specific files>
git commit -m "qa: <brief description>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Step 4: Reset Panel Between Sections

After testing items for one CSS section, reset state:
```javascript
// Via javascript_tool — re-select demo element
document.dispatchEvent(new CustomEvent('tuner:select', {
  detail: document.querySelector('[data-tuner-demo]')
}));
```
For full reset (corrupted state): `navigate` to `http://localhost:3000/demo`

### Step 5: Update Checklist & Commit

After completing all items in the scope:
1. Check off tested items in `QA_CHECKLIST.md`: `[ ]` -> `[x]` for passing items
2. Add notes under "Issues Found & Fixed" for any bugs fixed
3. Commit:
```
git add QA_CHECKLIST.md
git commit -m "qa: complete {scope} scope

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Step 6: Clear Context

Run `/clear` to reset conversation for the next scope.

## Interaction Recipes

### How to expand a section
```javascript
const headers = [...document.querySelectorAll('.__tuner-root [role="button"]')];
const target = headers.find(h => h.textContent.includes('Layout'));
target?.click();
```

### How to check for overflow
```javascript
function findOverflows() {
  const root = document.querySelector('.__tuner-root');
  const issues = [];
  root.querySelectorAll('*').forEach(el => {
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
      issues.push({ tag: el.tagName, text: el.textContent?.slice(0, 30),
        overflow: { x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight } });
    }
  });
  return issues;
}
findOverflows();
```

### How to test keyboard navigation
```javascript
const panel = document.querySelector('.__tuner-root');
panel.focus();
document.activeElement; // Check after Tab
```

### How to verify portal rendering
```javascript
// Portals render to document.body, not inside .__tuner-root
const portals = document.querySelectorAll('body > [data-radix-portal], body > [style*="position: fixed"]');
portals.length; // Should be > 0 when dropdown is open
```

## Rules

- **One scope per run.** Don't try to cover all 4 scopes.
- **Chrome tools are required.** If unavailable, stop immediately.
- **Write tests for every bug.** Even trivial fixes get regression tests.
- **Don't break existing tests.** Revert if your fix causes regressions.
- **Use existing test patterns.** Source-audit tests for structural issues, happy-dom for behavioral.
- **Reset state between sections.** Re-select demo element or reload page.
- **Work directly on main.** Do not create branches.
- **Use `mode: "bypassPermissions"`** when spawning subagents.
- **Skip items that need real layout engine.** Some visual checks can't be tested in happy-dom. Note as "verified visually" and move on.
- **Prefer existing patterns.** Theme tokens, timing tokens, portal pattern, etc.
- **For bug fixes, write a test first.** The test must fail before your fix.
