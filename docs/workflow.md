# Redial — User Journey

> Stop describing CSS to an AI and hoping it looks right. Just drag the slider.

---

## Who This Is For

You're a frontend developer building with Next.js. You care about how things look. You might be:

- A **solo founder** shipping a SaaS landing page who needs pixel-perfect results without a design team
- A **senior engineer** at a startup who owns the marketing site and is tired of CSS guesswork
- A **freelancer** building client sites where every visual revision costs you billable time

Your stack is modern — Next.js, React, TypeScript, maybe Tailwind — and you use AI tools like Claude Code to move fast. But there's one place where the AI workflow falls apart: **visual CSS**.

---

## The Pain: CSS Tuning Is a Feedback Loop

Every visual tweak follows the same loop: describe what you want → wait for AI/HMR → check the result → describe the delta → repeat. Each round takes 30–60 seconds. A full section takes 20–30 minutes.

The irony: **you could see exactly what you want if you could just drag a slider**, but instead you're playing telephone with a language model about pixel values. You can ship features at AI speed, but CSS tuning is still a manual feedback loop.

---

## The Journey With Redial

### 1. Install (once)

Add Redial as a dev dependency. It wraps your Next.js app with a floating panel — zero config, no CSS files to manage.

### 2. Activate

Press the hotkey. Your page enters selection mode. Hover over any element and see its boundaries highlighted.

### 3. Select

Click the element you want to tune. The panel opens, docked to the side of your viewport.

### 4. See Everything

The panel reads the element's computed styles and organizes them into sections you already know from Webflow:

- **Layout** — display, flex/grid direction, alignment, gap, wrapping
- **Spacing** — margin and padding with a visual box model
- **Size** — width, height, min/max, overflow
- **Typography** — font family, size, weight, line-height, letter-spacing, color
- **Borders** — width, style, color, radius per-corner
- **Effects** — opacity, box-shadow, cursor

No guessing what the current value is. No inspecting in DevTools. It's all right there.

### 5. Drag to Tune

Grab a slider and drag. The change appears instantly on the page — you're seeing the real rendered result, not a preview or mockup. Adjust until it looks right. Your eyes are the judge, not a text description.

### 6. Save to Source

Click Save. Redial writes the changes to your actual source files. Next.js HMR picks up the edit and confirms it. The styles are now part of your codebase — no copy-pasting from DevTools, no describing the change back to an AI.

### 7. Move On

Select the next element. Repeat. An entire section that took 30 minutes of prompt-and-check now takes 3–5 minutes of direct manipulation.

---

## Side by Side

### Tuning hero section padding, font size, and spacing

**With Claude Code alone (~25 min)**

```
You:    "Increase hero padding and make the heading larger"
Claude: [edits file] → HMR rebuilds → you check Chrome → too much padding
You:    "Reduce padding to 48px, heading to 36px"
Claude: [edits file] → HMR rebuilds → you check Chrome → line-height is off
You:    "Set line-height to 1.3, add 8px margin-bottom"
Claude: [edits file] → HMR rebuilds → you check Chrome → close but color is wrong
You:    "Make the heading color #1a1a2e"
Claude: [edits file] → HMR rebuilds → you check Chrome → done (for this element)

→ 4 round-trips × 45 sec each = ~3 min for ONE element
→ Hero section has ~8 tunable elements = ~25 min
```

**With Redial (~4 min)**

```
Hotkey → click heading → drag font-size slider → drag padding →
adjust line-height → pick color → Save
→ 40 sec per element, all visual, no waiting
→ 8 elements × 40 sec = ~5 min for the entire section
```

---

## What Makes This Different

**You're not describing CSS — you're doing CSS.** Redial removes the translation layer between what you see and what you want. No more telling an AI "make it bigger" and hoping it picks the right value. No more editing a file and waiting to see if your guess was right.

**Changes are real.** They write to your source files — not lost on reload like DevTools, not trapped in a design tool like Figma. Your git diff shows exactly what changed.

**It fits your existing workflow.** Redial is a dev dependency, not a platform. Use Claude Code for logic, data fetching, component architecture. Use Redial for the visual layer. They complement each other — AI for structure, direct manipulation for style.
