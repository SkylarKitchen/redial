/**
 * CSSEditorView.tsx — DevTools-like CSS rule viewer with inline editing.
 *
 * Displays all CSS rules matching a selected element in monospace code blocks.
 * Values are click-to-edit; edits apply as inline overrides via apply.ts.
 * Inline (element.style) blocks support adding/removing declarations.
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
  useEffect,
  type CSSProperties,
} from "react";
import { getMatchingRules, type CSSRuleBlock } from "./cssRuleGatherer";
import {
  applyInlineStyle,
  resetProp,
  subscribeOverrides,
  getOverrideSnapshot,
} from "../core/apply";
import { font, text, color, border, surface } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CSSEditorViewProps {
  selectedEl: Element | null;
}

interface EditingKey {
  blockIdx: number;
  declIdx: number;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: 8,
  fontFamily: font.mono,
  fontSize: 11,
};

const emptyStateStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: font.mono,
  fontSize: 11,
  color: text.hint,
};

const blockStyle: CSSProperties = {
  marginBottom: 8,
  position: "relative",
};

const stateBlockStyle: CSSProperties = {
  ...blockStyle,
  borderLeft: `2px solid ${color.indicatorGreen}`,
  paddingLeft: 6,
};

const selectorStyle: CSSProperties = {
  color: text.label,
  marginBottom: 2,
};

const mediaHeaderStyle: CSSProperties = {
  color: text.hint,
  fontSize: 10,
  marginBottom: 2,
};

const declLineStyle: CSSProperties = {
  paddingLeft: 16,
  display: "flex",
  alignItems: "center",
  minHeight: 20,
  position: "relative",
};

const propStyle: CSSProperties = {
  color: text.secondary,
};

const punctuationStyle: CSSProperties = {
  color: text.hint,
};

const editInputStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: 11,
  color: text.primary,
  background: "transparent",
  border: "none",
  outline: "none",
  padding: "0 2px",
  minWidth: 40,
};

const addBtnStyle: CSSProperties = {
  color: text.hint,
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: font.mono,
  fontSize: 11,
  paddingLeft: 16,
  padding: "2px 0 2px 16px",
};

const removeBtnBaseStyle: CSSProperties = {
  color: text.hint,
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: font.mono,
  fontSize: 11,
  marginLeft: 4,
  padding: "0 2px",
  opacity: 0,
  transition: "opacity 0.15s",
};

// ---------------------------------------------------------------------------
// EditInput — auto-selecting inline input
// ---------------------------------------------------------------------------

function EditInput({
  initialValue,
  onCommit,
  onCancel,
  onTab,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  onTab: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    ref.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommit(value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Tab") {
        e.preventDefault();
        onCommit(value);
        onTab();
      }
    },
    [value, onCommit, onCancel, onTab],
  );

  return (
    <input
      ref={ref}
      style={editInputStyle}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onCommit(value)}
    />
  );
}

// ---------------------------------------------------------------------------
// RuleBlock — renders a single CSSRuleBlock
// ---------------------------------------------------------------------------

function RuleBlock({
  block,
  blockIdx,
  editingKey,
  setEditingKey,
  strikethroughSet,
  selectedEl,
  totalBlocks,
}: {
  block: CSSRuleBlock;
  blockIdx: number;
  editingKey: EditingKey | null;
  setEditingKey: (key: EditingKey | null) => void;
  strikethroughSet: Map<string, { blockIdx: number; declIdx: number }>;
  selectedEl: Element;
  totalBlocks: number;
}) {
  const [hoveredDecl, setHoveredDecl] = useState<number | null>(null);
  const [addBtnHovered, setAddBtnHovered] = useState(false);
  const isInline = block.source === "inline";

  // Find the next editable value position (for Tab navigation)
  const advanceEditing = useCallback(
    (currentBlockIdx: number, currentDeclIdx: number) => {
      // Try next decl in same block
      if (currentDeclIdx + 1 < block.declarations.length) {
        setEditingKey({
          blockIdx: currentBlockIdx,
          declIdx: currentDeclIdx + 1,
        });
      }
      // Otherwise caller should handle cross-block advancement
      // For simplicity, clear editing state (Tab at end of block commits and exits)
      else {
        setEditingKey(null);
      }
    },
    [block.declarations.length, setEditingKey],
  );

  const wrapperStyle = block.isState ? stateBlockStyle : blockStyle;

  return (
    <div style={wrapperStyle}>
      {/* Media condition header */}
      {block.mediaCondition && (
        <div style={mediaHeaderStyle}>
          @media {block.mediaCondition}
        </div>
      )}

      {/* Selector line: .card { */}
      <div style={selectorStyle}>
        {block.selector}{" "}
        <span style={punctuationStyle}>{"{"}</span>
      </div>

      {/* Declarations */}
      {block.declarations.map((decl, declIdx) => {
        const isEditing =
          editingKey?.blockIdx === blockIdx &&
          editingKey?.declIdx === declIdx;
        const lastWins = strikethroughSet.get(decl.prop);
        const isOverridden =
          lastWins !== undefined &&
          (lastWins.blockIdx !== blockIdx || lastWins.declIdx !== declIdx);
        const isRowHovered = hoveredDecl === declIdx;

        const valueBaseStyle: CSSProperties = {
          color: text.primary,
          cursor: "pointer",
          padding: "0 2px",
          borderRadius: 2,
          ...(isOverridden
            ? { textDecoration: "line-through", opacity: 0.5 }
            : {}),
        };

        const valueStyle: CSSProperties = {
          ...valueBaseStyle,
          ...(isRowHovered && !isEditing
            ? { background: surface.hover }
            : {}),
        };

        return (
          <div
            key={declIdx}
            style={declLineStyle}
            onMouseEnter={() => setHoveredDecl(declIdx)}
            onMouseLeave={() => setHoveredDecl(null)}
          >
            {/* Property name */}
            <span style={propStyle}>{decl.prop}</span>
            <span style={punctuationStyle}>:&nbsp;</span>

            {/* Value (editable or static) */}
            {isEditing ? (
              <EditInput
                initialValue={decl.value}
                onCommit={(val) => {
                  applyInlineStyle(selectedEl, decl.prop, val);
                  setEditingKey(null);
                }}
                onCancel={() => setEditingKey(null)}
                onTab={() => advanceEditing(blockIdx, declIdx)}
              />
            ) : (
              <span
                style={valueStyle}
                data-testid={`value-${blockIdx}-${declIdx}`}
                onClick={() =>
                  setEditingKey({ blockIdx, declIdx })
                }
              >
                {decl.value}
              </span>
            )}

            <span style={punctuationStyle}>;</span>

            {/* Remove button (inline blocks only) */}
            {isInline && (
              <button
                style={{
                  ...removeBtnBaseStyle,
                  opacity: isRowHovered ? 1 : 0,
                }}
                onClick={() => resetProp(selectedEl, decl.prop)}
                aria-label={`Remove ${decl.prop}`}
              >
                &times;
              </button>
            )}
          </div>
        );
      })}

      {/* Closing brace */}
      <div style={punctuationStyle}>{"}"}</div>

      {/* Add button (inline blocks only) */}
      {isInline && (
        <button
          style={{
            ...addBtnStyle,
            color: addBtnHovered ? text.primary : text.hint,
          }}
          onMouseEnter={() => setAddBtnHovered(true)}
          onMouseLeave={() => setAddBtnHovered(false)}
          onClick={() => {
            // Add a placeholder declaration and enter edit mode on it
            // The actual addition happens when the user commits a value
            // We signal this by setting editingKey to the new index
            setEditingKey({
              blockIdx,
              declIdx: block.declarations.length,
            });
          }}
          aria-label="Add declaration"
        >
          +
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSSEditorView — main exported component
// ---------------------------------------------------------------------------

export function CSSEditorView({ selectedEl }: CSSEditorViewProps) {
  const overrideVersion = useSyncExternalStore(
    subscribeOverrides,
    getOverrideSnapshot,
  );

  const rules = useMemo(
    () => (selectedEl ? getMatchingRules(selectedEl) : []),
    [selectedEl, overrideVersion],
  );

  const [editingKey, setEditingKey] = useState<EditingKey | null>(null);

  // Build last-wins map for strikethrough tracking
  const strikethroughSet = useMemo(() => {
    const lastWins = new Map<
      string,
      { blockIdx: number; declIdx: number }
    >();
    for (let blockIdx = 0; blockIdx < rules.length; blockIdx++) {
      const block = rules[blockIdx];
      for (let declIdx = 0; declIdx < block.declarations.length; declIdx++) {
        lastWins.set(block.declarations[declIdx].prop, {
          blockIdx,
          declIdx,
        });
      }
    }
    return lastWins;
  }, [rules]);

  if (!selectedEl) {
    return (
      <div style={emptyStateStyle}>
        Select an element to see its CSS
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {rules.map((block, blockIdx) => (
        <RuleBlock
          key={`${block.source}-${block.selector}-${blockIdx}`}
          block={block}
          blockIdx={blockIdx}
          editingKey={editingKey}
          setEditingKey={setEditingKey}
          strikethroughSet={strikethroughSet}
          selectedEl={selectedEl}
          totalBlocks={rules.length}
        />
      ))}
    </div>
  );
}
