import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { Ico } from "./Ico";

/* Modal — centered overlay dialog. Portal to document.body, Escape-to-close,
   backdrop click-to-close. Mirrors ContextMenu's portal + dismiss wiring. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1000,
        animation: "ms-fade-in var(--dur-fast) var(--ease-out)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          overflow: "auto",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)",
          boxShadow: "var(--shadow-overlay)",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
          <IconButton size="sm" label="Close" onClick={onClose}>
            <Ico name="x" size={15} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
