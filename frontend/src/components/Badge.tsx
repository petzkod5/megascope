import React from "react";

type Tone = "neutral" | "up" | "down" | "warn" | "info";

/* Badge / status chip. Square, mono, uppercase micro-label. */
export function Badge({
  children,
  tone = "neutral",
  dot = false,
  style,
}: {
  children?: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  style?: React.CSSProperties;
}) {
  const tones: Record<Tone, { color: string; border: string; bg: string; dotc: string }> = {
    neutral: { color: "var(--text-secondary)", border: "var(--border-default)", bg: "var(--bg-elevated)", dotc: "var(--text-muted)" },
    up: { color: "var(--accent)", border: "var(--border-accent)", bg: "var(--accent-bg)", dotc: "var(--accent)" },
    down: { color: "var(--red)", border: "var(--red-dim)", bg: "var(--red-bg)", dotc: "var(--red)" },
    warn: { color: "var(--amber)", border: "var(--amber-dim)", bg: "var(--amber-bg)", dotc: "var(--amber)" },
    info: { color: "var(--cyan)", border: "var(--cyan-dim)", bg: "var(--cyan-bg)", dotc: "var(--cyan)" },
  };
  const t = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        height: "20px",
        padding: "0 8px",
        fontSize: "10px",
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        lineHeight: 1,
        color: t.color,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--radius-xs)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot ? <span style={{ width: 6, height: 6, borderRadius: "var(--radius-pill)", background: t.dotc, flex: "none" }} /> : null}
      {children}
    </span>
  );
}
