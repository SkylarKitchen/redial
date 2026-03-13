/**
 * fixtures.ts — Shared mock data for Design Lab variants.
 *
 * All variants render the same data to enable fair visual comparison.
 * This simulates the state of a WebflowPanel inspecting a flex container.
 */

export const mockPanel = {
  elementTag: "div",
  elementClasses: ".hero-section",
  breadcrumb: ["body", "main", "div.hero-section"],

  // Layout section
  layout: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "stretch",
    flexWrap: "nowrap",
    gap: 16,
    gapUnit: "px",
  },

  // Spacing section
  spacing: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 24,
    marginLeft: 0,
    paddingTop: 32,
    paddingRight: 40,
    paddingBottom: 32,
    paddingLeft: 40,
    unit: "px",
  },

  // Size section
  size: {
    width: "auto",
    height: "auto",
    minWidth: "0",
    maxWidth: "1200",
    minHeight: "0",
    maxHeight: "none",
    overflow: "visible",
  },

  // Typography section
  typography: {
    fontFamily: "Inter",
    fontWeight: "400",
    fontSize: 16,
    fontSizeUnit: "px",
    lineHeight: 1.5,
    letterSpacing: 0,
    color: "#171717",
    textAlign: "left",
    textDecoration: "none",
    textTransform: "none",
  },

  // Section metadata for indicator states
  indicators: {
    layout: {
      display: "modified",
      "flex-direction": "none",
      "justify-content": "none",
      "align-items": "none",
      gap: "modified",
    },
    spacing: {
      "margin-bottom": "modified",
      "padding-top": "modified",
      "padding-right": "modified",
      "padding-bottom": "modified",
      "padding-left": "modified",
    },
    typography: {
      "font-family": "modified",
      color: "none",
    },
  },
} as const;

export const sectionNames = [
  "Layout",
  "Spacing",
  "Size",
  "Position",
  "Typography",
  "Backgrounds",
  "Borders",
  "Effects",
] as const;

export const displayOptions = [
  { value: "block", label: "Block" },
  { value: "flex", label: "Flex" },
  { value: "grid", label: "Grid" },
  { value: "inline-block", label: "Inline Block" },
  { value: "inline", label: "Inline" },
  { value: "none", label: "None" },
] as const;

export const alignOptions = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "stretch", label: "Stretch" },
  { value: "baseline", label: "Baseline" },
] as const;

export const justifyOptions = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "space-between", label: "Between" },
  { value: "space-around", label: "Around" },
] as const;

export const fontWeightOptions = [
  { value: "100", label: "Thin" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "900", label: "Black" },
] as const;
