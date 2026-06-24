import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, React.CSSProperties> = {
  sm: { padding: "5px 10px", fontSize: "11px", height: "26px", gap: "6px" },
  md: { padding: "7px 14px", fontSize: "12px", height: "32px", gap: "8px" },
  lg: { padding: "10px 18px", fontSize: "13px", height: "40px", gap: "10px" },
};

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--accent)", color: "var(--text-on-accent)", border: "1px solid var(--accent)", fontWeight: 700 },
  secondary: { background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-default)", fontWeight: 600 },
  ghost: { background: "transparent", color: "var(--text-secondary)", border: "1px solid transparent", fontWeight: 600 },
  danger: { background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-dim)", fontWeight: 600 },
};

/* Command-center button. Square edges, mono label, uppercase + tracked. */
export function Button({
  children,
  variant = "secondary",
  size = "md",
  icon = null,
  disabled = false,
  uppercase = true,
  type = "button",
  onClick,
  style,
  ...rest
}: {
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  disabled?: boolean;
  uppercase?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  style?: React.CSSProperties;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const s = SIZES[size];
  const v = VARIANTS[variant];
  const [hover, setHover] = React.useState(false);

  const hoverStyle: React.CSSProperties | null =
    !disabled && hover
      ? variant === "primary"
        ? { background: "var(--accent-bright)" }
        : variant === "danger"
          ? { background: "rgba(255,92,92,0.16)", borderColor: "var(--red)" }
          : { background: "var(--bg-surface)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }
      : null;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        height: s.height,
        padding: s.padding,
        fontSize: s.fontSize,
        fontFamily: "var(--font-mono)",
        letterSpacing: uppercase ? "0.08em" : "0",
        textTransform: uppercase ? "uppercase" : "none",
        lineHeight: 1,
        borderRadius: "var(--radius-xs)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        whiteSpace: "nowrap",
        transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
        ...v,
        ...hoverStyle,
        ...style,
      }}
      {...rest}
    >
      {icon ? <span style={{ display: "inline-flex", width: "1em", height: "1em" }}>{icon}</span> : null}
      {children}
    </button>
  );
}
