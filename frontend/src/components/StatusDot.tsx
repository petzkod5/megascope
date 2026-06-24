import React from "react";
import type { Status } from "../types";

/* Status dot — operational state of a route/app. Pulses while live. */
export function StatusDot({
  status = "unknown",
  size = 8,
  pulse = true,
  style,
}: {
  status?: Status;
  size?: number;
  pulse?: boolean;
  style?: React.CSSProperties;
}) {
  const color =
    {
      up: "var(--status-up)",
      down: "var(--status-down)",
      warn: "var(--status-warn)",
      discovering: "var(--status-discovering)",
      unknown: "var(--status-unknown)",
    }[status] || "var(--status-unknown)";

  const glow =
    {
      up: "var(--glow-accent)",
      down: "var(--glow-red)",
      warn: "var(--glow-amber)",
      discovering: "0 0 12px -2px rgba(54,194,255,0.5)",
      unknown: "none",
    }[status] || "none";

  const animate = pulse && (status === "up" || status === "discovering" || status === "warn");

  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flex: "none",
        borderRadius: "var(--radius-pill)",
        background: color,
        boxShadow: glow,
        animation: animate ? "ms-pulse 1.8s var(--ease-in-out) infinite" : "none",
        ...style,
      }}
    />
  );
}
