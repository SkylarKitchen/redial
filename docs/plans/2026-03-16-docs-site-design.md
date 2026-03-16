# Redial Docs Site — Design

**Date:** 2026-03-16
**Reference:** agentation.com

## Decision

Build docs into the existing test-app (no separate site). Three pages: `/`, `/install`, `/features`.

## Pages

### `/` — Landing Page
- Hero: tagline + install snippet
- "How it works" — 5 numbered steps (same as README)
- Feature highlights — card grid (Layout, Spacing, Typography, Effects, etc.)
- Stats row (13 sections, 120+ properties, 0ms latency, HMR save)
- CTA: "Get Started" → /install

### `/install` — Setup Guide
- 3-step setup (Next.js plugin, API route, component) with copy-able code blocks
- Props reference table
- Exports reference
- Requirements (Next.js ≥13, React ≥18, Node ≥18)

### `/features` — Feature Showcase
- Organized by category: Panel Sections, Scoping, State Editing, Undo/Redo, Overlays, CSS Variables, Keyboard Shortcuts, Commit Flow, Copy/Export
- Each feature gets heading + description
- Keyboard shortcuts table

## Visual Design
- Cream/white bg (`#faf9f7` / `#fff`)
- Geist font (already loaded)
- Top nav: Redial logo | Overview | Install | Features | GitHub
- Left sidebar on /install and /features for section anchors
- Minimal, text-forward — no heavy graphics

## Interactive Demo
- Redial panel active on all docs pages via existing TunerProvider in layout
- Visitors can press backtick and tune the docs themselves
- The product IS the demo

## Migration
- Current `page.tsx` sample content (pricing, forms, gallery) stays at `/demo`
- `/` becomes the new landing page
- No changes to layout.tsx (Tuner already mounted globally)

## Content Source
All content extracted from existing README.md — restructured for multi-page presentation.
