import React from "react";
import { text, font, surface, border } from "../theme";

export function formatDisplayName(varName: string): string {
  return varName.startsWith("--") ? varName.slice(2) : varName;
}

export function VariableValue({
  value,
  aliasOf,
  resolvedColor,
}: {
  value: string;
  aliasOf?: string;
  resolvedColor?: string;
}) {
  if (aliasOf) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "1px 6px",
          borderRadius: 3,
          background: surface.subtle,
          border: `1px solid ${border.subtle}`,
          fontSize: 10,
          fontFamily: font.mono,
          color: text.secondary,
          maxWidth: "100%",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {resolvedColor && (
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: resolvedColor,
              border: `1px solid ${border.default}`,
              flexShrink: 0,
            }}
          />
        )}
        {formatDisplayName(aliasOf)}
      </span>
    );
  }

  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: font.mono,
        color: text.secondary,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      }}
    >
      {value}
    </span>
  );
}
