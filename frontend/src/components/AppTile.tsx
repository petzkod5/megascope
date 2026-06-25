import React from "react";
import { StatusDot } from "./StatusDot";
import { Ico } from "./Ico";
import type { Status } from "../types";

/* AppTile — one discovered route, as a dense status-led data row. Left status
   marker, icon/monogram chip, name + host, latency readout. */
export function AppTile({
  name,
  host,
  namespace,
  kind = "route",
  status = "up",
  latency,
  icon = null,
  monogram,
  href,
  onClick,
  onContextMenu,
  style,
}: {
  name: string;
  host?: string;
  namespace?: string;
  kind?: "route" | "link";
  status?: Status;
  latency?: number | null;
  icon?: React.ReactNode;
  monogram?: string;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  onContextMenu?: React.MouseEventHandler<HTMLAnchorElement>;
  style?: React.CSSProperties;
}) {
  const [hover, setHover] = React.useState(false);
  const markerColor =
    kind === "link"
      ? "var(--text-faint)"
      : {
          up: "var(--accent)",
          down: "var(--red)",
          warn: "var(--amber)",
          discovering: "var(--cyan)",
          unknown: "var(--text-faint)",
        }[status] || "var(--text-faint)";
  const dead = kind === "route" && status === "down";
  const mono = monogram || (name ? name.charAt(0).toUpperCase() : "?");

  return (
    <a
      href={href}
      onClick={onClick}
      onContextMenu={onContextMenu}
      target={href ? "_blank" : undefined}
      rel="noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "11px 14px 11px 16px",
        textDecoration: "none",
        background: hover ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: `1px solid ${hover ? "var(--border-accent)" : "var(--border-default)"}`,
        borderLeft: `2px solid ${markerColor}`,
        borderRadius: "var(--radius-xs)",
        boxShadow: hover ? "var(--glow-accent)" : "none",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        opacity: dead ? 0.62 : 1,
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          flex: "none",
          background: "var(--bg-inset)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xs)",
          color: "var(--accent)",
          fontFamily: "var(--font-mono)",
          fontSize: "14px",
          fontWeight: 700,
        }}
      >
        {icon ? <span style={{ display: "inline-flex", width: 17, height: 17 }}>{icon}</span> : mono}
      </span>

      <span style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {host}
        </span>
      </span>

      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px", flex: "none" }}>
        {kind === "link" ? (
          <span style={{ display: "inline-flex", color: "var(--text-faint)" }}>
            <Ico name="external-link" size={13} />
          </span>
        ) : (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <StatusDot status={status} size={7} />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: markerColor,
                }}
              >
                {status}
              </span>
            </span>
            {latency != null ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                {latency}ms
              </span>
            ) : namespace ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-faint)" }}>{namespace}</span>
            ) : null}
          </>
        )}
      </span>
    </a>
  );
}
