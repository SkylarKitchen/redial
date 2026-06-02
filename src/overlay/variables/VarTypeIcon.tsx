import React from "react";
import type { VarType } from "./discoverVariables";
import { text, font, border } from "../theme";

const FONT_RE = /font/i;

export function getVarTypeIcon(type: VarType, varName?: string): string {
  switch (type) {
    case "color":
      return "●";
    case "number":
      return "#";
    case "length":
      return "↗";
    case "string":
      return varName && FONT_RE.test(varName) ? "Ā" : "↗";
  }
}

export function VarTypeIcon({
  type,
  varName,
  colorValue,
}: {
  type: VarType;
  varName?: string;
  colorValue?: string;
}) {
  const icon = getVarTypeIcon(type, varName);

  if (type === "color" && colorValue) {
    return (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: colorValue,
            border: `1px solid ${border.default}`,
          }}
        />
      </span>
    );
  }

  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: font.mono,
        color: text.hint,
        width: 14,
        textAlign: "center",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {icon}
    </span>
  );
}
