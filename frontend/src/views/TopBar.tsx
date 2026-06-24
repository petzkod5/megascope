import React from "react";
import { Ico } from "../components/Ico";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { SearchInput } from "../components/SearchInput";
import { StatusDot } from "../components/StatusDot";

export function TopBar({
  query,
  setQuery,
  scanning,
  onRescan,
  onSettings,
  view,
  goHome,
  clusterName,
}: {
  query: string;
  setQuery: (v: string) => void;
  scanning: boolean;
  onRescan: () => void;
  onSettings: () => void;
  view: string;
  goHome: () => void;
  clusterName: string;
}) {
  const [clock, setClock] = React.useState("");
  React.useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 18,
        height: 56,
        padding: "0 22px",
        background: "rgba(8,8,10,0.86)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <div onClick={goHome} style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            background: "var(--accent)",
            color: "var(--text-on-accent)",
            borderRadius: "var(--radius-xs)",
            boxShadow: "var(--glow-accent)",
          }}
        >
          <Ico name="radar" size={18} stroke={2.4} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-primary)" }}>
            MEGASCOPE
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            cluster portal
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: 2 }}>
        <StatusDot status={scanning ? "discovering" : "up"} size={7} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: scanning ? "var(--cyan)" : "var(--accent)",
          }}
        >
          {scanning ? "scanning" : clusterName}
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", maxWidth: 460, margin: "0 auto" }}>
        <SearchInput
          id="ms-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Ico name="search" size={14} />}
          hint="⌘K"
          placeholder="filter routes, namespaces, hosts…"
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
          {clock}
        </span>
        <Button variant="primary" size="sm" icon={<Ico name="refresh-cw" size={13} />} onClick={onRescan}>
          Rescan
        </Button>
        <IconButton label="Settings" active={view === "settings"} onClick={onSettings}>
          <Ico name="settings" size={16} />
        </IconButton>
      </div>
    </header>
  );
}
