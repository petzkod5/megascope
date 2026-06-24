import React from "react";

type Tone = "default" | "accent" | "amber" | "red" | "cyan";

/* StatReadout — a large mono number with a tracked label and optional delta. */
export function StatReadout({
  label,
  value,
  unit,
  tone = "default",
  delta,
  deltaDir = "up",
  glow = false,
  style,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  tone?: Tone;
  delta?: React.ReactNode;
  deltaDir?: "up" | "down";
  glow?: boolean;
  style?: React.CSSProperties;
}) {
  const colors: Record<Tone, string> = {
    default: "var(--text-primary)",
    accent: "var(--accent)",
    amber: "var(--amber)",
    red: "var(--red)",
    cyan: "var(--cyan)",
  };
  const c = colors[tone] || colors.default;
  const deltaColor = deltaDir === "down" ? "var(--red)" : "var(--accent)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", ...style }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "34px",
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: c,
            textShadow: glow ? "var(--glow-text-accent)" : "none",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
        {unit ? <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>{unit}</span> : null}
        {delta != null ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: deltaColor, fontWeight: 600 }}>
            {deltaDir === "down" ? "▼" : "▲"} {delta}
          </span>
        ) : null}
      </div>
    </div>
  );
}
