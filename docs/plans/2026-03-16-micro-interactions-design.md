# Micro-Interactions Design: Tactile Precision

Inspired by animations.dev. CSS-only + lightweight hooks — Motion stays contained to panel/toolbar chrome.

## Philosophy

Every micro-interaction serves the adjustment loop (select → tune → see → tune). No choreography, no staggered reveals, no animation > 150ms on high-frequency controls.

## Shared Infrastructure

### `usePressScale(scale = 0.97)`
- `onMouseDown` → `transform: scale(N)` on element
- `onMouseUp` / `onMouseLeave` → clear, CSS transition handles spring-back
- Returns `{ pressHandlers, pressStyle }` to spread onto any element
- Press: `timing.fast` (80ms), release: `timing.release` (120ms) with `easeRelease` overshoot

### `useRubberBand(min, max)`
- Drag past boundaries → logarithmic resistance (value moves 1/3 speed)
- Release → snap back with `timing.expand` (150ms) ease-out
- Returns `{ clampedValue, rubberStyle }`

### New timing tokens
```ts
release: 120  // spring-back from press/drag
```

### New easing
```ts
easeRelease: "cubic-bezier(0.34, 1.56, 0.64, 1)"  // slight overshoot, settles fast
```

## Tier 1: High-Frequency Controls

| Element | Interaction | Detail |
|---------|------------|--------|
| Slider thumb | Press scale 0.93, 1.5x size while dragging | `usePressScale` on thumb |
| Slider track | Filled-portion pulse on value snap | Brief opacity flash on filled segment |
| Number inputs | Enhance `useValueFlash` with scale(1.02) bump | Combine bg flash + micro-scale |
| Color swatches | Press scale 0.92 | Smaller element = more aggressive scale |
| LabelScrub | Text color → `color.primary` during active drag | Inline style swap on drag state |
| Unit selector | Press scale on pill | `usePressScale` |

## Tier 2: Buttons & Toggles

| Element | Interaction | Detail |
|---------|------------|--------|
| All icon buttons | Press scale 0.93 | Smaller targets get more scale |
| Segmented control | Active indicator slides between segments | CSS `transition: left, width` on active-bg (100ms) |
| Section chevron | Verify uses `timing.expand` + `easeRelease` | Update existing transition |
| Visibility toggle | Press scale + opacity crossfade | `usePressScale` + `transition: opacity` |
| Remove buttons (x) | Press scale 0.9 + red flash | Brief bg highlight |
| SubSectionHeader | Subtle press on expand | `usePressScale(0.98)` |

## Tier 3: List Editors

| Element | Interaction | Detail |
|---------|------------|--------|
| Drag displacement | Items animate to new position | CSS `transition: transform` on list items |
| Drop settle | Micro-bounce on landing | `easeRelease` overshoot on final transform |
| Item add | Scale 0.95→1.0 + fade in | CSS class toggle, `timing.expand` |
| Item remove | Scale 1.0→0.95 + fade out | `timing.fast`, remove on `onTransitionEnd` |

## Tier 4: Panel Chrome

| Element | Interaction | Detail |
|---------|------------|--------|
| Footer buttons | Press scale 0.97 + color flash on action | Save=green, Reset=neutral |
| Scope pills | Press scale 0.95 | |
| Breadcrumb segments | Hover underline slides in from left | `scaleX(0→1)`, `transform-origin: left` |
| Clipboard dropdown | Press scale 0.98 | |
| Panel drag | Subtle scale(1.005) while dragging | Inline style during drag |

## Excluded (intentionally)

- No staggered entrances on section expand
- No loading spinners or skeleton states
- No entrance animations on panel content
- No Motion library expansion
- No animations > 150ms on high-frequency controls

## Reduced Motion

All interactions respect `getReducedMotion()`. `easeRelease` and all CSS transitions emit `0ms` when reduced motion is active, same as `ms()` today.
