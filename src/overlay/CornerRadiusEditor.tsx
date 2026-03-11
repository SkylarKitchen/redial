/**
 * CornerRadiusEditor.tsx — visual 4-corner radius control with linked/unlinked toggle
 *
 * When linked, a single input controls all corners.
 * When unlinked, 4 inputs sit at the corners of a preview rectangle.
 * A chain-link icon in the center toggles linked state.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { UnitSelector } from "./UnitSelector";
import { Link, Unlink } from "lucide-react";

export interface CornerRadiusEditorProps {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
  linked: boolean;
  onChange: (corner: string, value: number) => void;
  onLinkedChange: (linked: boolean) => void;
  unit: string;
  units: string[];
  onUnitChange: (unit: string) => void;
}

const CORNER_PROPS = [
  { key: "border-top-left-radius", label: "TL", prop: "topLeft" as const },
  { key: "border-top-right-radius", label: "TR", prop: "topRight" as const },
  { key: "border-bottom-right-radius", label: "BR", prop: "bottomRight" as const },
  { key: "border-bottom-left-radius", label: "BL", prop: "bottomLeft" as const },
];

function RadiusInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed !== value) {
      onChange(Math.max(0, Math.min(999, parsed)));
    }
  }, [draft, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commit();
      } else if (e.key === "Escape") {
        setDraft(String(value));
        setEditing(false);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const next = Math.min(999, value + step);
        setDraft(String(next));
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const next = Math.max(0, value - step);
        setDraft(String(next));
        onChange(next);
      }
    },
    [commit, value, onChange]
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        title={label}
        style={{
          width: "28px",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(99,102,241,0.5)",
          borderRadius: "2px",
          color: "rgba(255,255,255,0.9)",
          fontSize: "10px",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          textAlign: "center",
          padding: "2px",
          outline: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title={label}
      style={{
        display: "inline-block",
        width: "28px",
        fontSize: "10px",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        color: value !== 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
        cursor: "text",
        padding: "2px",
        borderRadius: "2px",
        textAlign: "center",
        background: "rgba(255,255,255,0.04)",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
      }}
    >
      {value}
    </span>
  );
}

function LinkIcon({ linked }: { linked: boolean }) {
  return linked
    ? <Link size={12} strokeWidth={1.5} color="#6366f1" style={{ display: "block" }} />
    : <Unlink size={12} strokeWidth={1.5} color="rgba(255,255,255,0.35)" style={{ display: "block" }} />;
}

export function CornerRadiusEditor({
  topLeft,
  topRight,
  bottomRight,
  bottomLeft,
  linked,
  onChange,
  onLinkedChange,
  unit,
  units,
  onUnitChange,
}: CornerRadiusEditorProps) {
  const values = { topLeft, topRight, bottomRight, bottomLeft };

  const handleChange = useCallback(
    (cornerKey: string, prop: keyof typeof values) =>
      (val: number) => {
        if (linked) {
          // Update all corners
          for (const c of CORNER_PROPS) {
            onChange(c.key, val);
          }
        } else {
          onChange(cornerKey, val);
        }
      },
    [linked, onChange]
  );

  // Clamp preview radii to reasonable visual range
  const maxPreviewR = 20;
  const previewTL = Math.min(topLeft, maxPreviewR);
  const previewTR = Math.min(topRight, maxPreviewR);
  const previewBR = Math.min(bottomRight, maxPreviewR);
  const previewBL = Math.min(bottomLeft, maxPreviewR);

  if (linked) {
    // Single input mode — show one input, unit selector, and the preview
    return (
      <div style={{ padding: "8px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <RadiusInput
            value={topLeft}
            onChange={handleChange("border-top-left-radius", "topLeft")}
            label="All corners"
          />
          <UnitSelector value={unit} options={units} onChange={onUnitChange} />
          <div
            style={{
              width: "24px",
              height: "24px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: `${previewTL}px ${previewTR}px ${previewBR}px ${previewBL}px`,
              transition: "border-radius 100ms",
            }}
          />
          <button
            onClick={() => onLinkedChange(false)}
            title="Unlink corners"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              borderRadius: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <LinkIcon linked={true} />
          </button>
        </div>
      </div>
    );
  }

  // Unlinked mode — 4 corner inputs around a preview rectangle
  return (
    <div style={{ padding: "8px 12px" }}>
      <div style={{ position: "relative", width: "100%" }}>
        {/* Top row: TL and TR */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <RadiusInput
            value={topLeft}
            onChange={handleChange("border-top-left-radius", "topLeft")}
            label="Top-left radius"
          />
          <RadiusInput
            value={topRight}
            onChange={handleChange("border-top-right-radius", "topRight")}
            label="Top-right radius"
          />
        </div>

        {/* Preview rectangle with link button + unit selector in center */}
        <div style={{ position: "relative", margin: "0 32px" }}>
          <div
            style={{
              width: "100%",
              height: "32px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: `${previewTL}px ${previewTR}px ${previewBR}px ${previewBL}px`,
              background: "rgba(255,255,255,0.03)",
              transition: "border-radius 100ms",
            }}
          />
          {/* Link/unlink button + unit selector centered */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <button
              onClick={() => onLinkedChange(true)}
              title="Link corners"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "3px",
                cursor: "pointer",
                padding: "3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              }}
            >
              <LinkIcon linked={false} />
            </button>
            <UnitSelector value={unit} options={units} onChange={onUnitChange} />
          </div>
        </div>

        {/* Bottom row: BL and BR */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
          <RadiusInput
            value={bottomLeft}
            onChange={handleChange("border-bottom-left-radius", "bottomLeft")}
            label="Bottom-left radius"
          />
          <RadiusInput
            value={bottomRight}
            onChange={handleChange("border-bottom-right-radius", "bottomRight")}
            label="Bottom-right radius"
          />
        </div>
      </div>
    </div>
  );
}
