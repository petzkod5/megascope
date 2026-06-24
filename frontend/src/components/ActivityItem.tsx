import React from "react";

/* ActivityItem — one line in the live discovery feed. */
export function ActivityItem({
  time,
  event = "discovered",
  target,
  namespace,
  fresh = false,
  style,
}: {
  time: string;
  event?: string;
  target: React.ReactNode;
  namespace?: string;
  fresh?: boolean;
  style?: React.CSSProperties;
}) {
  const cfg =
    (
      {
        discovered: { color: "var(--accent)", glyph: "+", label: "DISCOVERED" },
        updated: { color: "var(--cyan)", glyph: "~", label: "UPDATED" },
        removed: { color: "var(--red)", glyph: "−", label: "REMOVED" },
        degraded: { color: "var(--amber)", glyph: "!", label: "DEGRADED" },
      } as Record<string, { color: string; glyph: string; label: string }>
    )[event] || { color: "var(--text-muted)", glyph: "·", label: event.toUpperCase() };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "7px 0",
        borderBottom: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        animation: fresh ? "ms-fade-in var(--dur-base) var(--ease-out)" : "none",
        ...style,
      }}
    >
      <span style={{ color: "var(--text-faint)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{time}</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          flex: "none",
          color: cfg.color,
          border: `1px solid ${cfg.color}`,
          borderRadius: "var(--radius-xs)",
          fontWeight: 700,
          fontSize: "11px",
        }}
      >
        {cfg.glyph}
      </span>
      <span style={{ color: cfg.color, fontWeight: 700, letterSpacing: "0.08em", flex: "none", width: 86 }}>{cfg.label}</span>
      <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{target}</span>
      {namespace ? <span style={{ color: "var(--text-muted)", marginLeft: "auto", flex: "none" }}>{namespace}</span> : null}
    </div>
  );
}
