import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Clamp into the viewport once the menu's measured size is known.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const m = 8;
    setPos({
      x: Math.max(m, Math.min(x, window.innerWidth - width - m)),
      y: Math.max(m, Math.min(y, window.innerHeight - height - m)),
    });
  }, [x, y]);

  // Focus the menu so Escape works without a prior click.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Dismiss on outside pointerdown / Escape / scroll / resize / window blur.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      style={{
        position: "fixed",
        top: pos.y,
        left: pos.x,
        zIndex: 1000,
        minWidth: 168,
        padding: 4,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        boxShadow: "var(--shadow-overlay)",
        outline: "none",
        animation: "ms-fade-in var(--dur-fast) var(--ease-snap)",
      }}
    >
      {items.map((it, i) => (
        <button
          key={i}
          role="menuitem"
          disabled={it.disabled}
          onClick={() => {
            if (it.disabled) return;
            it.onSelect();
            onClose();
          }}
          onMouseEnter={(e) => {
            if (!it.disabled) e.currentTarget.style.background = "var(--bg-surface)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            width: "100%",
            padding: "7px 10px",
            background: "transparent",
            border: "none",
            borderRadius: "var(--radius-xs)",
            color: it.disabled ? "var(--text-faint)" : "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            textAlign: "left",
            cursor: it.disabled ? "not-allowed" : "pointer",
          }}
        >
          {it.icon && <span style={{ display: "inline-flex", color: "var(--text-muted)" }}>{it.icon}</span>}
          {it.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
