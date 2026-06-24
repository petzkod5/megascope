import { useMemo } from "react";
import { Ico } from "../components/Ico";
import { AppTile } from "../components/AppTile";
import type { Route } from "../types";

export function TileGrid({
  routes,
  onOpen,
  view = "grid",
}: {
  routes: Route[];
  onOpen: (r: Route) => void;
  view?: "grid" | "list";
}) {
  const columns = view === "list" ? "1fr" : "repeat(auto-fill, minmax(258px, 1fr))";
  const groups = useMemo(() => {
    const m = new Map<string, Route[]>();
    for (const r of routes) {
      const g = r.group || "Apps";
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [routes]);

  if (!routes.length) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: 13 }}>
        <div style={{ display: "inline-flex", marginBottom: 14, color: "var(--text-faint)" }}>
          <Ico name="radar" size={40} stroke={1.4} />
        </div>
        <div>no routes match the filter.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {groups.map(([g, rs]) => (
        <section key={g}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
              {g}
            </h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>{rs.length.toString().padStart(2, "0")}</span>
            <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: columns, gap: 10 }}>
            {rs.map((r) => (
              <AppTile
                key={r.namespace + "/" + r.name}
                name={r.name}
                host={r.host}
                namespace={r.namespace}
                status={r.status}
                latency={r.latency}
                icon={r.icon ? <Ico name={r.icon} size={17} /> : null}
                onClick={(e) => {
                  e.preventDefault();
                  onOpen(r);
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
