import React from "react";
import { Ico } from "../components/Ico";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { Badge } from "../components/Badge";
import { Panel } from "../components/Panel";
import { Tabs } from "../components/Tabs";
import { StatReadout } from "../components/StatReadout";
import { Sparkline } from "../components/Sparkline";
import type { ParentRef, Route } from "../types";

const STATUS_LABEL: Record<string, string> = {
  up: "Operational",
  down: "Unreachable",
  warn: "Degraded",
  discovering: "Discovering",
  unknown: "Unknown",
};

type Tone = "accent" | "amber" | "red" | "cyan" | "default";

export function AppDetail({ route, history, onBack }: { route: Route; history: number[]; onBack: () => void }) {
  const [tab, setTab] = React.useState("overview");
  const tone: Tone = ({ up: "accent", warn: "amber", down: "red", discovering: "cyan" } as Record<string, Tone>)[route.status] || "default";
  const slug = route.name.toLowerCase().replace(/\s+/g, "-");

  const KV = ({ k, v, mono = true, color }: { k: React.ReactNode; v: React.ReactNode; mono?: boolean; color?: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>{k}</span>
      <span style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-display)", fontSize: 12, color: color || "var(--text-primary)", textAlign: "right" }}>{v}</span>
    </div>
  );

  const parent = route.parentRefs && route.parentRefs[0];
  const gateway = parent ? (parent.namespace ? `${parent.name}.${parent.namespace}` : parent.name || "—") : "—";
  const backend = route.backend || `${slug}:80`;
  const backendName = backend.split(":")[0];
  const backendPort = backend.includes(":") ? backend.split(":")[1] : "80";

  const annotations: Array<[string, string]> = [
    ["app.megascope.io/name", route.name],
    ["app.megascope.io/group", route.group || "—"],
    ["app.megascope.io/icon", route.icon || "—"],
    ["app.megascope.io/url", route.url || "—"],
  ];

  const parentList: ParentRef[] =
    route.parentRefs && route.parentRefs.length ? route.parentRefs : [{ name: "gateway", namespace: "gateway" }];
  const parentRefsYaml = parentList
    .map((p) => {
      let s = `    - name: ${p.name}`;
      if (p.namespace) s += `\n      namespace: ${p.namespace}`;
      if (p.sectionName) s += `\n      sectionName: ${p.sectionName}`;
      return s;
    })
    .join("\n");

  const yaml = `apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: ${slug}
  namespace: ${route.namespace}
  annotations:
    app.megascope.io/name: "${route.name}"
    app.megascope.io/group: "${route.group || ""}"
    app.megascope.io/icon: "${route.icon || ""}"
spec:
  parentRefs:
${parentRefsYaml}
  hostnames:
    - "${route.host}"
  rules:
    - backendRefs:
        - name: ${backendName}
          port: ${backendPort}`;

  const series = route.status === "down" ? [10, 10, 10] : history.length ? history : [route.latency ?? 0];
  const min = history.length ? Math.min(...history) : route.latency ?? null;
  const max = history.length ? Math.max(...history) : route.latency ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button variant="ghost" size="sm" icon={<Ico name="arrow-left" size={13} />} onClick={onBack}>
          Portal
        </Button>
        <span style={{ color: "var(--text-faint)" }}>/</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{route.namespace}</span>
        <span style={{ color: "var(--text-faint)" }}>/</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)" }}>{route.name}</span>
      </div>

      <Panel corners bodyPadding="20px var(--gutter)">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              flex: "none",
              background: "var(--bg-inset)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xs)",
              color: "var(--accent)",
            }}
          >
            {route.icon ? <Ico name={route.icon} size={26} stroke={1.8} /> : <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{route.name.charAt(0).toUpperCase()}</span>}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{route.name}</h1>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
              <Ico name="link" size={12} /> {route.host || "—"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={route.status === "up" ? "up" : route.status === "warn" ? "warn" : route.status === "down" ? "down" : "info"} dot>
              {STATUS_LABEL[route.status] || "Unknown"}
            </Badge>
            <Button
              variant="primary"
              icon={<Ico name="external-link" size={13} />}
              disabled={!route.url}
              onClick={() => route.url && window.open(route.url, "_blank", "noreferrer")}
            >
              Open
            </Button>
          </div>
        </div>
      </Panel>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "routing", label: "Routing" },
          { id: "annotations", label: "Annotations", count: 4 },
          { id: "yaml", label: "YAML" },
        ]}
      />

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <Panel title="Latency · live probe" corners>
            <div style={{ display: "flex", gap: 30, marginBottom: 18 }}>
              <StatReadout label="Latency" value={route.latency != null ? route.latency : "—"} unit="ms" tone={tone === "default" ? "accent" : tone} />
              <StatReadout label="Min" value={min != null ? min : "—"} unit={min != null ? "ms" : undefined} />
              <StatReadout label="Max" value={max != null ? max : "—"} unit={max != null ? "ms" : undefined} />
            </div>
            <Sparkline data={series} tone={tone === "amber" ? "amber" : tone === "red" ? "red" : "accent"} width={520} height={64} />
          </Panel>
          <Panel title="Metadata" corners>
            <KV k="Namespace" v={route.namespace} />
            <KV k="Group" v={route.group || "—"} />
            <KV k="Status" v={(STATUS_LABEL[route.status] || "Unknown").toUpperCase()} color={tone === "default" ? undefined : `var(--${tone})`} />
            <KV k="Hostnames" v={route.hostnames.join(", ") || "—"} />
            <KV k="Backend" v={backend} />
          </Panel>
        </div>
      )}

      {tab === "routing" && (
        <Panel title="Gateway routing" corners>
          <KV k="Gateway" v={gateway} color={gateway === "—" ? undefined : "var(--accent)"} />
          {parent?.sectionName ? <KV k="Listener" v={parent.sectionName} color="var(--accent)" /> : null}
          <KV k="Hostname" v={route.host || "—"} />
          <KV k="Path match" v="PathPrefix( / )" />
          <KV k="Backend service" v={backendName + "." + route.namespace + ":" + backendPort} />
          <KV k="Link" v={route.url || "—"} color="var(--cyan)" />
        </Panel>
      )}

      {tab === "annotations" && (
        <Panel title="HTTPRoute annotations" corners meta={route.namespace + "/" + slug}>
          {annotations.map(([k, v]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              <span style={{ color: "var(--cyan)" }}>{k}</span>
              <span style={{ color: "var(--text-primary)" }}>{v}</span>
            </div>
          ))}
        </Panel>
      )}

      {tab === "yaml" && (
        <Panel
          title="Manifest"
          corners
          actions={
            <IconButton label="Copy" size="sm" onClick={() => navigator.clipboard?.writeText(yaml)}>
              <Ico name="copy" size={13} />
            </IconButton>
          }
          bodyPadding="0"
        >
          <pre style={{ margin: 0, padding: "16px var(--gutter)", background: "var(--bg-inset)", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)", overflow: "auto", whiteSpace: "pre" }}>
            {yaml}
          </pre>
        </Panel>
      )}
    </div>
  );
}
