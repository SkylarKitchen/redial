---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, security, async, react]
---

# EyeDropper API Missing AbortController

## Problem Statement
The EyeDropper API in ColorPickerEnhanced.tsx opens a browser-native picker that returns a promise. If the component unmounts while the picker is open, the resolved promise calls setState on an unmounted component — a memory leak and potential crash.

## Findings
- File: `src/overlay/ColorPickerEnhanced.tsx`
- The `.open()` call accepts `{ signal }` from an AbortController
- No cleanup on unmount

## Resolution
Agent fix in progress — adds AbortController ref, passes signal to `.open()`, cleans up on unmount.
