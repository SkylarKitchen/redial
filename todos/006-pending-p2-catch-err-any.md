---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, type-safety]
dependencies: []
---

# Replace catch(err: any) with catch(err: unknown) in commit.ts

## Problem Statement
Line 681 of commit.ts uses `catch (err: any)` which bypasses type checking.

## Findings
- **Source**: TypeScript reviewer
- **Location**: `src/server/commit.ts` line 681

## Proposed Solutions

### Option A: Use unknown and instanceof check
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
```
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria
- [ ] No `any` types in catch blocks in commit.ts
- [ ] Typecheck passes
