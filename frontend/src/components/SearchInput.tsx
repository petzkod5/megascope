import React from "react";

/* Search / filter input. Mono, square, with optional leading icon and hint. */
export function SearchInput({
  value,
  onChange,
  placeholder = "filter…",
  icon = null,
  hint = null,
  size = "md",
  style,
  ...rest
}: {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "value" | "onChange">) {
  const [focus, setFocus] = React.useState(false);
  const h = size === "sm" ? 30 : size === "lg" ? 42 : 36;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        height: h,
        padding: "0 10px",
        background: "var(--bg-inset)",
        border: `1px solid ${focus ? "var(--border-accent)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-xs)",
        boxShadow: focus ? "0 0 0 3px var(--accent-bg)" : "none",
        transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        ...style,
      }}
    >
      {icon ? (
        <span style={{ display: "inline-flex", width: 14, height: 14, color: "var(--text-muted)", flex: "none" }}>{icon}</span>
      ) : null}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "var(--text-primary)",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          letterSpacing: "0.01em",
        }}
        {...rest}
      />
      {hint ? (
        <kbd
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: "var(--text-muted)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xs)",
            padding: "2px 5px",
            flex: "none",
          }}
        >
          {hint}
        </kbd>
      ) : null}
    </div>
  );
}
