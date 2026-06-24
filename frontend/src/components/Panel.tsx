import React from "react";

/* Panel — the base surface container. Optional header with a tracked uppercase
   title, corner ticks, and a right-side action slot. */
export function Panel({
  title,
  meta,
  actions,
  corners = true,
  children,
  bodyPadding = "var(--gutter)",
  style,
  ...rest
}: {
  title?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  corners?: boolean;
  children?: React.ReactNode;
  bodyPadding?: string;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLElement>) {
  const Tick = ({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) => (
    <span
      style={{
        position: "absolute",
        width: 6,
        height: 6,
        borderColor: "var(--border-strong)",
        borderStyle: "solid",
        borderWidth: 0,
        ...(pos === "tl" && { top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 }),
        ...(pos === "tr" && { top: -1, right: -1, borderTopWidth: 1, borderRightWidth: 1 }),
        ...(pos === "bl" && { bottom: -1, left: -1, borderBottomWidth: 1, borderLeftWidth: 1 }),
        ...(pos === "br" && { bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 }),
      }}
    />
  );

  return (
    <section
      style={{
        position: "relative",
        background: "var(--surface-panel)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        boxShadow: "var(--shadow-panel)",
        ...style,
      }}
      {...rest}
    >
      {corners && (["tl", "tr", "bl", "br"] as const).map((p) => <Tick key={p} pos={p} />)}
      {(title || actions) && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "12px var(--gutter)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", minWidth: 0 }}>
            {title ? (
              <h3
                style={{
                  margin: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                {title}
              </h3>
            ) : null}
            {meta ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>{meta}</span>
            ) : null}
          </div>
          {actions ? <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>{actions}</div> : null}
        </header>
      )}
      <div style={{ padding: bodyPadding }}>{children}</div>
    </section>
  );
}
