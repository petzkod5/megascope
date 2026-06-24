import { useEffect, useMemo, useRef, useState } from "react";
import type { Route, State, Status } from "./types";
import { TopBar } from "./views/TopBar";
import { HealthBar } from "./views/HealthBar";
import { TileGrid } from "./views/TileGrid";
import { DiscoveryFeed } from "./views/DiscoveryFeed";
import { AppDetail } from "./views/AppDetail";
import { Settings } from "./views/Settings";
import { Ico } from "./components/Ico";
import { IconButton } from "./components/IconButton";

const POLL_MS = 15_000;
const HISTORY_CAP = 48;
const keyOf = (r: { namespace: string; name: string }) => r.namespace + "/" + r.name;

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "up" | "warn" | "down";

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string; color: string }> = [
  { id: "all", label: "All", color: "var(--text-secondary)" },
  { id: "up", label: "Up", color: "var(--accent)" },
  { id: "warn", label: "Warn", color: "var(--amber)" },
  { id: "down", label: "Down", color: "var(--red)" },
];

function StatusChips({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {STATUS_FILTERS.map((f) => {
        const active = value === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 9px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: active ? f.color : "var(--text-muted)",
              background: active ? "var(--bg-elevated)" : "transparent",
              border: `1px solid ${active ? "var(--border-default)" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-xs)",
              cursor: "pointer",
            }}
          >
            {f.label}
            <span style={{ color: active ? f.color : "var(--text-faint)", fontWeight: 700 }}>{counts[f.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function App() {
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"dashboard" | "detail" | "settings">("dashboard");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("ms-view") === "list" ? "list" : "grid"));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Per-route latency history, accumulated client-side across polls (the backend
  // doesn't persist a time series), feeding the detail sparkline.
  const history = useRef<Map<string, number[]>>(new Map());

  const fetchState = useMemo(
    () => async (signal?: AbortSignal) => {
      try {
        const res = await fetch("/api/routes", { signal });
        if (!res.ok) throw new Error(String(res.status));
        const st = (await res.json()) as State;
        for (const r of st.routes) {
          if (r.latency == null) continue;
          const k = keyOf(r);
          const arr = history.current.get(k) ?? [];
          arr.push(r.latency);
          if (arr.length > HISTORY_CAP) arr.splice(0, arr.length - HISTORY_CAP);
          history.current.set(k, arr);
        }
        setData(st);
        setError(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(true);
      }
    },
    []
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchState(ctrl.signal);
    const t = window.setInterval(() => fetchState(ctrl.signal), POLL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(t);
    };
  }, [fetchState]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    localStorage.setItem("ms-view", viewMode);
  }, [viewMode]);

  // ⌘K / Ctrl-K focuses the filter input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("ms-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onRescan = () => {
    setScanning(true);
    fetchState().finally(() => setTimeout(() => setScanning(false), 900));
  };

  const cluster = data?.cluster;
  const routes = data?.routes ?? [];

  const queryFiltered = useMemo(() => {
    if (!query) return routes;
    const q = query.toLowerCase();
    return routes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.namespace.toLowerCase().includes(q) ||
        (r.host || "").toLowerCase().includes(q) ||
        (r.group || "").toLowerCase().includes(q)
    );
  }, [query, routes]);

  const counts = useMemo(() => {
    const by = (s: Status) => queryFiltered.filter((r) => r.status === s).length;
    return { all: queryFiltered.length, up: by("up"), warn: by("warn"), down: by("down") } as Record<StatusFilter, number>;
  }, [queryFiltered]);

  const visible = useMemo(
    () => (statusFilter === "all" ? queryFiltered : queryFiltered.filter((r) => r.status === statusFilter)),
    [queryFiltered, statusFilter]
  );

  const downCount = routes.filter((r) => r.status === "down").length;
  const lastScan = data ? Math.max(0, Math.round((now - data.updated_at) / 1000)) : 0;
  const clusterName = cluster?.name || "production";

  const liveSelected: Route | null = selectedKey ? routes.find((r) => keyOf(r) === selectedKey) ?? null : null;

  const open = (r: Route) => {
    setSelectedKey(keyOf(r));
    setView("detail");
  };
  const goHome = () => {
    setView("dashboard");
    setSelectedKey(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", backgroundImage: "var(--grid-bg)" }}>
      <TopBar
        query={query}
        setQuery={setQuery}
        scanning={scanning}
        onRescan={onRescan}
        onSettings={() => setView(view === "settings" ? "dashboard" : "settings")}
        view={view}
        goHome={goHome}
        clusterName={clusterName}
      />

      <main style={{ maxWidth: 1440, margin: "0 auto", padding: 22 }}>
        {!data && !error && (
          <div style={{ padding: "80px 0", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: 13 }}>
            <div style={{ display: "inline-flex", marginBottom: 14, color: "var(--cyan)" }}>
              <Ico name="radar" size={40} stroke={1.4} />
            </div>
            <div>scanning the cluster…</div>
          </div>
        )}

        {error && !data && (
          <div style={{ padding: "80px 0", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--red)", fontSize: 13 }}>
            <div style={{ display: "inline-flex", marginBottom: 14 }}>
              <Ico name="plug-zap" size={40} stroke={1.4} />
            </div>
            <div>couldn’t reach the megascope API.</div>
          </div>
        )}

        {data && cluster && view === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <HealthBar c={cluster} downCount={downCount} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, alignItems: "start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                    {visible.length} {visible.length === 1 ? "route" : "routes"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <StatusChips value={statusFilter} onChange={setStatusFilter} counts={counts} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <IconButton label="Grid view" active={viewMode === "grid"} onClick={() => setViewMode("grid")}>
                        <Ico name="layout-grid" size={15} />
                      </IconButton>
                      <IconButton label="List view" active={viewMode === "list"} onClick={() => setViewMode("list")}>
                        <Ico name="list" size={15} />
                      </IconButton>
                    </div>
                  </div>
                </div>
                <TileGrid routes={visible} onOpen={open} view={viewMode} />
              </div>
              <div style={{ position: "sticky", top: 78 }}>
                <DiscoveryFeed activity={data.activity} lastScan={lastScan} />
              </div>
            </div>
          </div>
        )}

        {data && view === "detail" && liveSelected && (
          <AppDetail
            route={liveSelected}
            history={liveSelected.history?.length ? liveSelected.history : history.current.get(selectedKey!) ?? []}
            onBack={goHome}
          />
        )}
        {data && view === "detail" && !liveSelected && (
          <div style={{ padding: "60px 0", textAlign: "center", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>route no longer discovered.</div>
        )}

        {view === "settings" && <Settings onBack={goHome} />}
      </main>
    </div>
  );
}
