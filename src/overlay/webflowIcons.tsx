/**
 * webflowIcons.tsx — Webflow-style SVG icons extracted from Figma
 *
 * Each icon is a 16x16 SVG that uses currentColor for fill,
 * with optional opacity layers for multi-tone icons.
 */

interface IconProps {
  size?: number;
  className?: string;
}

// ─── Display Icons ──────────────────────────────────────────────────

/** Block display — horizontal bars + centered rectangle */
export function DisplayBlockIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path opacity="0.4" d="M13 13.9966H3V12.9966H13V13.9966ZM13 3.00345H3V2.00345H13V3.00345Z" fill="currentColor" />
      <path d="M12.1025 5.00488C12.6067 5.05621 13 5.48232 13 6V10L12.9951 10.1025C12.9472 10.573 12.573 10.9472 12.1025 10.9951L12 11H4C3.48232 11 3.05621 10.6067 3.00488 10.1025L3 10V6C3 5.44772 3.44772 5 4 5H12L12.1025 5.00488ZM4 10H12V6H4V10Z" fill="currentColor" />
    </svg>
  );
}

/** Flex display — two column blocks */
export function DisplayFlexIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M6.5 3C7.05228 3 7.5 3.44772 7.5 4V12C7.5 12.5523 7.05228 13 6.5 13H4C3.44772 13 3 12.5523 3 12V4C3 3.44772 3.44772 3 4 3H6.5ZM12 3C12.5523 3 13 3.44772 13 4V12C13 12.5523 12.5523 13 12 13H9.5C8.94772 13 8.5 12.5523 8.5 12V4C8.5 3.44772 8.94772 3 9.5 3H12ZM4 12H6.5V4H4V12ZM9.5 12H12V4H9.5V12Z" fill="currentColor" />
    </svg>
  );
}

/** Grid display — 2x2 grid of squares */
export function DisplayGridIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M7 3H4L4 6H7V3ZM8 12V9C8 8.44772 7.55228 8 7 8H4C3.44772 8 3 8.44772 3 9V12C3 12.5523 3.44772 13 4 13H7C7.55228 13 8 12.5523 8 12ZM9 9V12C9 12.5523 9.44772 13 10 13H13C13.5523 13 14 12.5523 14 12V9C14 8.44772 13.5523 8 13 8H10C9.44772 8 9 8.44772 9 9ZM8 6V3C8 2.44772 7.55228 2 7 2H4C3.44772 2 3 2.44772 3 3V6C3 6.55228 3.44772 7 4 7H7C7.55228 7 8 6.55228 8 6ZM9 3V6C9 6.55228 9.44772 7 10 7H13C13.5523 7 14 6.55228 14 6V3C14 2.44772 13.5523 2 13 2H10C9.44772 2 9 2.44772 9 3ZM7 9H4L4 12H7V9ZM13 3H10V6H13V3ZM13 9H10V12H13V9Z" fill="currentColor" />
    </svg>
  );
}

/** Inline-block display — vertical lines + centered square */
export function DisplayInlineBlockIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <g opacity="0.4">
        <path d="M1 1V15H2V1H1Z" fill="currentColor" />
        <path d="M14 1V15H15V1H14Z" fill="currentColor" />
      </g>
      <path fillRule="evenodd" clipRule="evenodd" d="M4 5C4 4.44772 4.44772 4 5 4H11C11.5523 4 12 4.44772 12 5V11C12 11.5523 11.5523 12 11 12H5C4.44772 12 4 11.5523 4 11V5ZM11 5L5 5V11H11V5Z" fill="currentColor" />
    </svg>
  );
}

/** Inline display — two "A" letterforms */
export function DisplayInlineIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <g opacity="0.6">
        <path fillRule="evenodd" clipRule="evenodd" d="M3.62583 3H5.37412L7.72712 11H6.68476L6.0965 8.99994H2.9035L2.31524 11H1.27289L3.62583 3ZM5.80237 7.99994L4.62586 3.9999H4.3741L3.19761 7.99994H5.80237Z" fill="currentColor" />
        <path d="M16 13L1 13V14L16 14V13Z" fill="currentColor" />
      </g>
      <path fillRule="evenodd" clipRule="evenodd" d="M13.3741 3H11.6258L9.27289 11H10.3152L10.9035 8.99994H14.0965L14.6848 11H15.7271L13.3741 3ZM12.6259 3.9999L13.8024 7.99994H11.1976L12.3741 3.9999H12.6259Z" fill="currentColor" />
    </svg>
  );
}

/** Hide / display:none — eye with slash */
export function DisplayHideIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M10.705 11.4121L13.6464 14.3536L14.3536 13.6464L2.35355 1.64645L1.64645 2.35355L4.38809 5.0952C3.39354 5.7612 2.59319 6.69432 2.08964 7.79148C2.02887 7.92388 2.02888 8.07621 2.08965 8.20861C3.11615 10.4451 5.37597 12 8.00001 12C8.9654 12 9.88149 11.7895 10.705 11.4121ZM9.94073 10.6478L5.11151 5.81862C4.25764 6.34656 3.55887 7.10168 3.09961 8.00004C4.01048 9.78173 5.86346 11 8.00001 11C8.68307 11 9.33715 10.8755 9.94073 10.6478Z" fill="currentColor" />
      <path d="M13.9104 8.20852C13.5777 8.93349 13.1154 9.58684 12.553 10.1388L11.846 9.43181C12.2702 9.01681 12.6276 8.53367 12.9004 7.99996C11.9896 6.21827 10.1366 5 8.00004 5C7.81173 5 7.62562 5.00946 7.44216 5.02794L6.57166 4.15745C7.03126 4.05439 7.50928 4 8.00004 4C10.6241 4 12.8839 5.55488 13.9104 7.79139C13.9712 7.9238 13.9712 8.07612 13.9104 8.20852Z" fill="currentColor" />
    </svg>
  );
}

// ─── Align Icons ────────────────────────────────────────────────────

/** Align items: start (row) */
export function AlignStartIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 2H15V3H11V7.5C11 7.77614 10.7761 8 10.5 8L9.5 8C9.22386 8 9 7.77614 9 7.5V3L8 3L8 11.5C8 11.7761 7.77614 12 7.5 12H6.5C6.22386 12 6 11.7761 6 11.5L6 3L2 3V2Z" fill="currentColor" />
    </svg>
  );
}

/** Align items: center (row) */
export function AlignCenterIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 7V2.5C8 2.22386 7.77614 2 7.5 2H6.5C6.22386 2 6 2.22386 6 2.5V7L2 7V8L15 8V7H11V4.5C11 4.22386 10.7761 4 10.5 4L9.5 4C9.22386 4 9 4.22386 9 4.5V7H8Z" fill="currentColor" />
      <path d="M8 9V13.5C8 13.7761 7.77614 14 7.5 14H6.5C6.22386 14 6 13.7761 6 13.5V9H8Z" fill="currentColor" />
      <path d="M10.5 12C10.7761 12 11 11.7761 11 11.5V9H9V11.5C9 11.7761 9.22386 12 9.5 12H10.5Z" fill="currentColor" />
    </svg>
  );
}

/** Align items: end (row) */
export function AlignEndIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M11 13V4.5C11 4.22386 10.7761 4 10.5 4H9.5C9.22386 4 9 4.22386 9 4.5L9 13H8V8.5C8 8.22386 7.77614 8 7.5 8L6.5 8C6.22386 8 6 8.22386 6 8.5V13L2 13V14L15 14V13H11Z" fill="currentColor" />
    </svg>
  );
}

/** Align items: stretch (row) */
export function AlignStretchIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M6 3L2 3V2H15V3L11 3V13L15 13V14L2 14V13H6L6 3ZM8 3L9 3L9 13H8L8 3Z" fill="currentColor" />
    </svg>
  );
}

/** Align items: baseline (row) */
export function AlignBaselineIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M8 7V3.5C8 3.22386 7.77614 3 7.5 3H5.5C5.22386 3 5 3.22386 5 3.5L5 7H2V8H5V13.5C5 13.7761 5.22386 14 5.5 14H7.5C7.77614 14 8 13.7761 8 13.5V8H9V10.5C9 10.7761 9.22386 11 9.5 11H11.5C11.7761 11 12 10.7761 12 10.5V8L15 8V7L12 7V3.5C12 3.22386 11.7761 3 11.5 3H9.5C9.22386 3 9 3.22386 9 3.5V7H8ZM6 4V7H7V4L6 4ZM10 7H11V4L10 4V7Z" fill="currentColor" />
    </svg>
  );
}

// ─── Justify Icons ──────────────────────────────────────────────────

/** Justify content: flex-start (row) */
export function JustifyStartIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 14V11H4.5C4.77614 11 5 10.7761 5 10.5V4.5C5 4.22386 4.77614 4 4.5 4H3V1H2V14H3Z" fill="currentColor" />
      <path d="M6 4.5C6 4.22386 6.22386 4 6.5 4H7.5C7.77614 4 8 4.22386 8 4.5V10.5C8 10.7761 7.77614 11 7.5 11H6.5C6.22386 11 6 10.7761 6 10.5V4.5Z" fill="currentColor" />
    </svg>
  );
}

/** Justify content: center (row) */
export function JustifyCenterIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M7 14V11H5.5C5.22386 11 5 10.7761 5 10.5V4.5C5 4.22386 5.22386 4 5.5 4H7V1H8V14H7Z" fill="currentColor" />
      <path d="M11 4.5C11 4.22386 10.7761 4 10.5 4H9.5C9.22386 4 9 4.22386 9 4.5V10.5C9 10.7761 9.22386 11 9.5 11H10.5C10.7761 11 11 10.7761 11 10.5V4.5Z" fill="currentColor" />
    </svg>
  );
}

/** Justify content: flex-end (row) */
export function JustifyEndIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M13 14V11H11.5C11.2239 11 11 10.7761 11 10.5V4.5C11 4.22386 11.2239 4 11.5 4H13V1H14V14H13Z" fill="currentColor" />
      <path d="M10 4.5C10 4.22386 9.77614 4 9.5 4H8.5C8.22386 4 8 4.22386 8 4.5V10.5C8 10.7761 8.22386 11 8.5 11H9.5C9.77614 11 10 10.7761 10 10.5V4.5Z" fill="currentColor" />
    </svg>
  );
}

/** Justify content: space-between (row) */
export function JustifySpaceBetweenIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M14 4L14 1L15 1L15 14L14 14L14 11L12.5 11C12.2239 11 12 10.7761 12 10.5L12 4.5C12 4.22386 12.2239 4 12.5 4L14 4Z" fill="currentColor" />
      <path d="M2 14L2 1L3 1L3 4L4.5 4C4.77614 4 5 4.22386 5 4.5L5 10.5C5 10.7761 4.77614 11 4.5 11L3 11L3 14L2 14Z" fill="currentColor" />
    </svg>
  );
}

/** Justify content: space-around (row) */
export function JustifySpaceAroundIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 14V1H3V14H2Z" fill="currentColor" />
      <path d="M4.5 4C4.22386 4 4 4.22386 4 4.5L4 10.5C4 10.7761 4.22386 11 4.5 11H5.5C5.77614 11 6 10.7761 6 10.5L6 4.5C6 4.22386 5.77614 4 5.5 4L4.5 4Z" fill="currentColor" />
      <path d="M11.5 11C11.2239 11 11 10.7761 11 10.5V4.5C11 4.22386 11.2239 4 11.5 4L12.5 4C12.7761 4 13 4.22386 13 4.5V10.5C13 10.7761 12.7761 11 12.5 11H11.5Z" fill="currentColor" />
      <path d="M14 14V1H15V14H14Z" fill="currentColor" />
    </svg>
  );
}

// ─── Utility Icons ──────────────────────────────────────────────────

/** Arrow reverse — bidirectional arrow swap */
export function ArrowReverseIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M11.8535 6.85397L9.70703 8.99851H15V9.99851H9.70898L11.8535 12.1421L11.5 12.4966L11.1465 12.8501L8.14648 9.85202L7.79297 9.49851L8.14648 9.14499L11.1465 6.14694L11.8535 6.85397ZM7.85352 5.14792L8.20703 5.50144L7.85352 5.85495L4.85352 8.853L4.5 8.49948L4.14648 8.14499L6.29102 6.00144H1V5.00144H6.29297L4.14648 2.8569L4.85352 2.14987L7.85352 5.14792Z" fill="currentColor" />
    </svg>
  );
}

/** Unlock icon */
export function UnlockIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M9 5C9 3.89543 9.89543 3 11 3C12.1046 3 13 3.89543 13 5V6H14V5C14 3.34315 12.6569 2 11 2C9.34315 2 8 3.34315 8 5V7H3C2.44772 7 2 7.44771 2 8V12C2 12.5523 2.44772 13 3 13H9C9.55228 13 10 12.5523 10 12V8C10 7.44772 9.55228 7 9 7V5ZM3 8H9V12H3V8Z" fill="currentColor" />
    </svg>
  );
}

/** Lock icon (for linked gap state) */
export function LockIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M11 5C11 3.89543 10.1046 3 9 3C7.89543 3 7 3.89543 7 5V7H4C3.44772 7 3 7.44772 3 8V12C3 12.5523 3.44772 13 4 13H14C14.5523 13 15 12.5523 15 12V8C15 7.44772 14.5523 7 14 7H12V5ZM10 5V7H8V5C8 4.44772 8.44772 4 9 4C9.55228 4 10 4.44772 10 5ZM4 8H14V12H4V8Z" fill="currentColor" />
    </svg>
  );
}

// ─── Overflow Icons (from Figma Webflow design) ─────────────────────

/** Overflow visible — content extends beyond container bounds */
export function OverflowVisibleIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M15 2H1V3H15V2Z" fill="currentColor" />
      <path d="M15 9H1V10H15V9Z" fill="currentColor" />
      <path opacity="0.4" d="M3 3H13V14H3V3Z" fill="currentColor" />
    </svg>
  );
}

/** Overflow hidden — content clipped at container edge */
export function OverflowHiddenIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M15 2H1V3L15 3V2Z" fill="currentColor" />
      <path d="M15 11H1V12H15V11Z" fill="currentColor" />
      <path opacity="0.4" d="M3 3H13V11H3V3Z" fill="currentColor" />
    </svg>
  );
}

/** Overflow scroll — scrollbar indicator with down arrow */
export function OverflowScrollIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path opacity="0.4" d="M3 3H8V11H3V3Z" fill="currentColor" />
      <path d="M1 2H15V3L1 3V2Z" fill="currentColor" />
      <path d="M1 11H8V12H1V11Z" fill="currentColor" />
      <path d="M12 11.2929L10.3536 9.64645L9.64645 10.3536L12.5 13.2071L15.3536 10.3536L14.6464 9.64645L13 11.2929V5H12V11.2929Z" fill="currentColor" />
    </svg>
  );
}

/** More horizontal dots — three dots for options menu */
export function MoreDotsIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 8C3 7.44772 3.44772 7 4 7C4.55228 7 5 7.44772 5 8C5 8.55228 4.55228 9 4 9C3.44772 9 3 8.55228 3 8Z" fill="currentColor" />
      <path d="M7 8C7 7.44772 7.44772 7 8 7C8.55228 7 9 7.44772 9 8C9 8.55228 8.55228 9 8 9C7.44772 9 7 8.55228 7 8Z" fill="currentColor" />
      <path d="M11 8C11 7.44772 11.4477 7 12 7C12.5523 7 13 7.44772 13 8C13 8.55228 12.5523 9 12 9C11.4477 9 11 8.55228 11 8Z" fill="currentColor" />
    </svg>
  );
}

/** Chevron small down — for dropdown selects */
export function ChevronSmallDownIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M8.00002 9.29293L10.6465 6.64648L11.3536 7.35359L8.00002 10.7071L4.64647 7.35359L5.35358 6.64648L8.00002 9.29293Z" fill="currentColor" />
    </svg>
  );
}

// ─── Position Pin Preset Icons ──────────────────────────────────

/** Position: top-left — small rect pinned to top-left */
export function PositionTopLeftIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="3" y="3" width="5" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Position: top-right — small rect pinned to top-right */
export function PositionTopRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="8" y="3" width="5" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Position: bottom-left — small rect pinned to bottom-left */
export function PositionBottomLeftIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="3" y="9" width="5" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Position: bottom-right — small rect pinned to bottom-right */
export function PositionBottomRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="8" y="9" width="5" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Position: left — tall rect pinned to left edge */
export function PositionLeftIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="3" y="3" width="4" height="10" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Position: right — tall rect pinned to right edge */
export function PositionRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="9" y="3" width="4" height="10" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Position: bottom — wide rect pinned to bottom edge */
export function PositionBottomIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="3" y="9" width="10" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Position: top — wide rect pinned to top edge */
export function PositionTopIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="3" y="3" width="10" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Position: all edges — rect filling entire container */
export function PositionAllIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="3" y="3" width="10" height="10" rx="0.5" fill="currentColor" />
    </svg>
  );
}

// ─── Float Icons ────────────────────────────────────────────────

/** Float left — content floating to left with text wrapping right */
export function FloatLeftIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="3" width="5" height="5" rx="0.5" fill="currentColor" />
      <path opacity="0.4" d="M9 4H14M9 6H14M9 8H14M2 10H14M2 12H14" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Float right — content floating to right with text wrapping left */
export function FloatRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="9" y="3" width="5" height="5" rx="0.5" fill="currentColor" />
      <path opacity="0.4" d="M2 4H7M2 6H7M2 8H7M2 10H14M2 12H14" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// ─── Clear Icons ────────────────────────────────────────────────

/** Clear left — clear left float */
export function ClearLeftIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 4H7V8H3V4Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M3 9H13" stroke="currentColor" strokeWidth="1" />
      <path d="M3 11H13" stroke="currentColor" strokeWidth="1" />
      <path d="M3 13H13" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Clear right — clear right float */
export function ClearRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M9 4H13V8H9V4Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M3 9H13" stroke="currentColor" strokeWidth="1" />
      <path d="M3 11H13" stroke="currentColor" strokeWidth="1" />
      <path d="M3 13H13" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Clear both — clear both floats */
export function ClearBothIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 4H7V8H3V4Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M9 4H13V8H9V4Z" fill="currentColor" fillOpacity="0.3" />
      <path d="M3 9H13" stroke="currentColor" strokeWidth="1" />
      <path d="M3 11H13" stroke="currentColor" strokeWidth="1" />
      <path d="M3 13H13" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
