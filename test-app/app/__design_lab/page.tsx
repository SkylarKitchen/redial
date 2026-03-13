'use client';

/**
 * Design Lab — WebflowPanel Redesign
 *
 * 5 variants exploring different styling directions for the CSS panel.
 * Each variant is a static visual mockup showing how the panel would look
 * with a different design approach.
 */

import { VariantA } from '../../../.claude-design/lab/variants/VariantA';
import { VariantB } from '../../../.claude-design/lab/variants/VariantB';
import { VariantC } from '../../../.claude-design/lab/variants/VariantC';
import { VariantD } from '../../../.claude-design/lab/variants/VariantD';
import { VariantE } from '../../../.claude-design/lab/variants/VariantE';
import { FeedbackOverlay } from './FeedbackOverlay';

const variants = [
  {
    id: 'A' as const,
    name: 'Strict Token Grid',
    rationale: 'Every element on a precise pixel grid. Consistent borders, uniform surfaces, strict type scale. Solves inconsistency through rigid systematization.',
    Component: VariantA,
  },
  {
    id: 'B' as const,
    name: 'Borderless Webflow',
    rationale: 'Inspired by the actual Webflow Designer. No inner borders — controls float on surfaces. Section dividers only. Hover reveals interactivity.',
    Component: VariantB,
  },
  {
    id: 'C' as const,
    name: 'Dense Figma',
    rationale: 'Figma-style density. Tighter vertical spacing, two-column layouts, grouped inputs with internal dividers. More properties visible at once.',
    Component: VariantC,
  },
  {
    id: 'D' as const,
    name: 'Progressive Disclosure',
    rationale: 'Accordion with value summaries. Collapsed sections show current values inline. Only one section open at a time. Click headers to expand.',
    Component: VariantD,
  },
  {
    id: 'E' as const,
    name: 'Apple Refined',
    rationale: 'Premium feel with inset containers, generous spacing, large touch targets, and subtle depth. Pill-shaped controls with inner shadows.',
    Component: VariantE,
  },
];

export default function DesignLabPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        padding: '32px 40px 24px',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        backgroundColor: '#fff',
      }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          color: '#111',
          margin: 0,
        }}>
          WebflowPanel — Design Lab
        </h1>
        <p style={{
          fontSize: 14,
          color: '#666',
          margin: '8px 0 0',
          lineHeight: 1.5,
        }}>
          Redesigning for consistency. 5 variants exploring different styling approaches.
          <br />
          <strong>Pain point:</strong> Inconsistent styling across sections
          &nbsp;·&nbsp;
          <strong>Brand:</strong> Premium, Utilitarian, Professional
          &nbsp;·&nbsp;
          <strong>Density:</strong> Comfortable
        </p>
        <p style={{
          fontSize: 13,
          color: '#999',
          margin: '12px 0 0',
        }}>
          Click the "Add Feedback" button (bottom-right) to leave comments on specific elements.
        </p>
      </header>

      {/* Variant Grid */}
      <main style={{ padding: '32px 40px 120px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 32,
          maxWidth: 1800,
        }}>
          {variants.map(({ id, name, rationale, Component }) => (
            <div
              key={id}
              data-variant={id}
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              {/* Variant header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: '#3B82F6',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {id}
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2, lineHeight: 1.4 }}>
                    {rationale}
                  </div>
                </div>
              </div>

              {/* Variant content — centered panel mockup */}
              <div style={{
                padding: '24px 20px',
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: '#fafafa',
                minHeight: 500,
              }}>
                <Component />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Feedback Overlay */}
      <FeedbackOverlay targetName="WebflowPanel" />
    </div>
  );
}
