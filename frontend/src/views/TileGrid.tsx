import { useCallback, useMemo, useState } from "react";
import { Ico } from "../components/Ico";
import { AppTile } from "../components/AppTile";
import { ContextMenu } from "../components/ContextMenu";
import type { Route, CustomLink } from "../types";

const hostOf = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
};

export function TileGrid({
  routes,
  links = [],
  onOpen,
  onEditLink,
  view = "grid",
}: {
  routes: Route[];
  links?: CustomLink[];
  onOpen: (r: Route) => void;
  onEditLink?: (l: CustomLink) => void;
  view?: "grid" | "list";
}) {
  const columns = view === "list" ? "1fr" : "repeat(auto-fill, minmax(258px, 1fr))";
  const [menu, setMenu] = useState<
    | { kind: "route"; route: Route; x: number; y: number }
    | { kind: "link"; link: CustomLink; x: number; y: number }
    | null
  >(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const groups = useMemo(() => {
    const m = new Map<string, { routes: Route[]; links: CustomLink[] }>();
    const ensure = (g: string) => {
      let v = m.get(g);
      if (!v) {
        v = { routes: [], links: [] };
        m.set(g, v);
      }
      return v;
    };
    for (const r of routes) ensure(r.group || "Apps").routes.push(r);
    for (const l of links) ensure(l.group || "Links").links.push(l);
    for (const v of m.values()) v.links.sort((a, b) => a.name.localeCompare(b.name));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [routes, links]);

  if (!routes.length && !links.length) {
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
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>{(rs.routes.length + rs.links.length).toString().padStart(2, "0")}</span>
            <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: columns, gap: 10 }}>
            {rs.routes.map((r) => (
              <AppTile
                key={r.namespace + "/" + r.name}
                name={r.name}
                host={r.host}
                namespace={r.namespace}
                status={r.status}
                latency={r.latency}
                icon={r.icon ? <Ico name={r.icon} size={17} /> : null}
                href={r.url || undefined}
                onClick={(e) => {
                  if (!r.url) {
                    e.preventDefault();
                    onOpen(r);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ kind: "route", route: r, x: e.clientX, y: e.clientY });
                }}
              />
            ))}
            {rs.links.map((l) => (
              <AppTile
                key={"link/" + l.id}
                kind="link"
                name={l.name}
                host={hostOf(l.url)}
                icon={<Ico name={l.icon || "link"} size={17} />}
                href={l.url}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ kind: "link", link: l, x: e.clientX, y: e.clientY });
                }}
              />
            ))}
          </div>
        </section>
      ))}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={
            menu.kind === "route"
              ? [
                  {
                    label: "Open app",
                    icon: <Ico name="external-link" size={14} />,
                    disabled: !menu.route.url,
                    onSelect: () => {
                      if (menu.route.url) window.open(menu.route.url, "_blank", "noreferrer");
                    },
                  },
                  {
                    label: "Details",
                    icon: <Ico name="info" size={14} />,
                    onSelect: () => onOpen(menu.route),
                  },
                ]
              : [
                  {
                    label: "Open link",
                    icon: <Ico name="external-link" size={14} />,
                    onSelect: () => window.open(menu.link.url, "_blank", "noreferrer"),
                  },
                  {
                    label: "Edit…",
                    icon: <Ico name="pencil" size={14} />,
                    onSelect: () => onEditLink?.(menu.link),
                  },
                ]
          }
        />
      )}
    </div>
  );
}
