import React from "react";

type Tone = "accent" | "amber" | "red" | "cyan";

/* Sparkline — tiny inline SVG trend line. Pure SVG, no deps. */
export function Sparkline({
  data = [],
  width = 120,
  height = 28,
  tone = "accent",
  fill = true,
  style,
}: {
  data?: number[];
  width?: number;
  height?: number;
  tone?: Tone;
  fill?: boolean;
  style?: React.CSSProperties;
}) {
  const color =
    {
      accent: "var(--accent)",
      amber: "var(--amber)",
      red: "var(--red)",
      cyan: "var(--cyan)",
    }[tone] || "var(--accent)";

  const pts = data.length ? data : [0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const stepX = pts.length > 1 ? width / (pts.length - 1) : width;
  const pad = 3;
  const coords = pts.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gid = "sparkfill-" + tone;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <path d={area} fill={`url(#${gid})`} /> : null}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.length ? <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="2" fill={color} /> : null}
    </svg>
  );
}
