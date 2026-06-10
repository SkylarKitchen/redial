/**
 * CSSEditorView.tsx — DevTools-like CSS rule viewer with inline editing.
 *
 * Displays all CSS rules matching a selected element in monospace code blocks.
 * - Stylesheet blocks: click-to-edit values (structured, read-only layout)
 * - element.style block: freeform textarea (type property: value; lines freely)
 *
 * Edits apply as inline overrides via apply.ts.
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
import { shadowAwareActiveElement } from "../core/shadowRoot";

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

const inlineTextareaStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: 11,
  color: text.primary,
  background: "transparent",
  border: "none",
  outline: "none",
  resize: "none",
  width: "100%",
  padding: 0,
  margin: 0,
  lineHeight: "20px",
  overflow: "hidden",
};

// ---------------------------------------------------------------------------
// Helpers: declarationsToText / textToDeclarations
// ---------------------------------------------------------------------------

function declarationsToText(
  decls: { prop: string; value: string }[],
): string {
  return decls.map((d) => `  ${d.prop}: ${d.value};`).join("\n");
}

function textToDeclarations(
  text: string,
): { prop: string; value: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line.includes(":"))
    .map((line) => {
      const clean = line.endsWith(";") ? line.slice(0, -1) : line;
      const idx = clean.indexOf(":");
      return {
        prop: clean.slice(0, idx).trim(),
        value: clean.slice(idx + 1).trim(),
      };
    })
    .filter((d) => d.prop && d.value);
}

// ---------------------------------------------------------------------------
// InlineStyleEditor — freeform textarea for element.style block
// ---------------------------------------------------------------------------

function InlineStyleEditor({
  block,
  selectedEl,
}: {
  block: CSSRuleBlock;
  selectedEl: Element;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(() =>
    declarationsToText(block.declarations),
  );
  const prevDeclsRef = useRef(block.declarations);

  // Re-sync when declarations change externally (e.g. override version bump)
  useEffect(() => {
    if (block.declarations !== prevDeclsRef.current) {
      prevDeclsRef.current = block.declarations;
      // Only re-sync if the textarea is NOT focused (don't clobber mid-edit)
      if (shadowAwareActiveElement() !== textareaRef.current) {
        setContent(declarationsToText(block.declarations));
      }
    }
  }, [block.declarations]);

  // Auto-grow textarea height
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "0";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [content]);

  const handleBlur = useCallback(() => {
    const newDecls = textToDeclarations(content);
    const oldProps = new Set(block.declarations.map((d) => d.prop));
    const newProps = new Set(newDecls.map((d) => d.prop));

    // Apply new/changed properties
    for (const d of newDecls) {
      const existing = block.declarations.find((e) => e.prop === d.prop);
      if (!existing || existing.value !== d.value) {
        applyInlineStyle(selectedEl, d.prop, d.value);
      }
    }

    // Reset deleted properties
    for (const prop of oldProps) {
      if (!newProps.has(prop)) {
        resetProp(selectedEl, prop);
      }
    }
  }, [content, block.declarations, selectedEl]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        textareaRef.current?.blur();
      }
    },
    [],
  );

  return (
    <div style={blockStyle} data-testid="inline-style-editor">
      {/* Selector line: element.style { */}
      <div style={selectorStyle}>
        {block.selector}{" "}
        <span style={punctuationStyle}>{"{"}</span>
      </div>

      {/* Freeform textarea */}
      <textarea
        ref={textareaRef}
        style={inlineTextareaStyle}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        rows={1}
        data-testid="inline-textarea"
      />

      {/* Closing brace */}
      <div style={punctuationStyle}>{"}"}</div>
    </div>
  );
}

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
  // Inline blocks are rendered by InlineStyleEditor instead
  if (block.source === "inline") return null;

  const [hoveredDecl, setHoveredDecl] = useState<number | null>(null);

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
          </div>
        );
      })}

      {/* Closing brace */}
      <div style={punctuationStyle}>{"}"}</div>
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
      {rules.map((block, blockIdx) =>
        block.source === "inline" ? (
          <InlineStyleEditor
            key="inline"
            block={block}
            selectedEl={selectedEl}
          />
        ) : (
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
        ),
      )}
    </div>
  );
}
