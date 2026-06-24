import React from "react";

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

/* Tabs — segmented, square, mono. Underline marker in accent. */
export function Tabs({
  tabs = [],
  value,
  onChange,
  style,
}: {
  tabs?: TabDef[];
  value?: string;
  onChange?: (id: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: "2px",
        borderBottom: "1px solid var(--border-subtle)",
        ...style,
      }}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange && onChange(t.id)}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 14px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
              marginBottom: "-1px",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "color var(--dur-fast) var(--ease-out)",
            }}
          >
            {t.label}
            {t.count != null ? (
              <span style={{ fontSize: "10px", color: active ? "var(--accent)" : "var(--text-faint)", fontWeight: 700 }}>{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
