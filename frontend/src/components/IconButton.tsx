import React from "react";

/* Square icon-only button. For toolbars and tile actions. */
export function IconButton({
  children,
  size = "md",
  active = false,
  disabled = false,
  label,
  onClick,
  style,
  ...rest
}: {
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  disabled?: boolean;
  label?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  style?: React.CSSProperties;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const dim = size === "sm" ? 26 : size === "lg" ? 40 : 32;
  const [hover, setHover] = React.useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        padding: 0,
        borderRadius: "var(--radius-xs)",
        background: active ? "var(--accent-bg)" : hover && !disabled ? "var(--bg-elevated)" : "transparent",
        border: `1px solid ${active ? "var(--border-accent)" : hover && !disabled ? "var(--border-default)" : "var(--border-subtle)"}`,
        color: active ? "var(--accent)" : hover && !disabled ? "var(--text-primary)" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all var(--dur-fast) var(--ease-out)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: "inline-flex", width: dim * 0.5, height: dim * 0.5 }}>{children}</span>
    </button>
  );
}
