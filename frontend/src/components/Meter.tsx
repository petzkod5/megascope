import React from "react";

type Tone = "accent" | "amber" | "red" | "cyan";

/* Meter — a thin horizontal gauge with a tracked label and value. Tone shifts
   automatically by threshold when `auto` is set. */
export function Meter({
  label,
  value = 0,
  max = 100,
  unit = "%",
  tone = "accent",
  auto = false,
  style,
}: {
  label?: React.ReactNode;
  value?: number;
  max?: number;
  unit?: string;
  tone?: Tone;
  auto?: boolean;
  style?: React.CSSProperties;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  let resolved: Tone = tone;
  if (auto) resolved = pct >= 90 ? "red" : pct >= 70 ? "amber" : "accent";
  const color =
    {
      accent: "var(--accent)",
      amber: "var(--amber)",
      red: "var(--red)",
      cyan: "var(--cyan)",
    }[resolved] || "var(--accent)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px", ...style }}>
      {label != null && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {label}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {value}
            <span style={{ color: "var(--text-muted)" }}>{unit}</span>
          </span>
        </div>
      )}
      <div
        style={{
          position: "relative",
          height: "6px",
          background: "var(--bg-inset)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-xs)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: pct + "%",
            background: color,
            boxShadow: `0 0 10px -1px ${color}`,
            transition: "width var(--dur-base) var(--ease-out)",
          }}
        />
      </div>
    </div>
  );
}
