import React from "react";
import { Ico } from "../components/Ico";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";

/* Settings — a configuration reference. The poll interval and discovery scope
   are controlled by the backend (env: POLL_SECONDS, PROBE_HEALTH); the controls
   here mirror those behaviours. */
export function Settings({ onBack }: { onBack: () => void }) {
  const [poll, setPoll] = React.useState("30");
  const [scope, setScope] = React.useState({ all: true, hidden: false, ingress: true });

  const Row = ({ label, desc, children }: { label: React.ReactNode; desc: React.ReactNode; children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "14px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ flex: "none" }}>{children}</div>
    </div>
  );

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        width: 40,
        height: 22,
        padding: 2,
        background: on ? "var(--accent)" : "var(--bg-inset)",
        border: "1px solid " + (on ? "var(--accent)" : "var(--border-default)"),
        borderRadius: "var(--radius-xs)",
        cursor: "pointer",
        display: "flex",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <span style={{ width: 16, height: 16, background: on ? "var(--text-on-accent)" : "var(--text-muted)", display: "block" }} />
    </button>
  );

  const intervals = ["15", "30", "60", "120"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button variant="ghost" size="sm" icon={<Ico name="arrow-left" size={13} />} onClick={onBack}>
          Portal
        </Button>
        <span style={{ color: "var(--text-faint)" }}>/</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)" }}>settings</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Discovery" corners meta="backend-controlled">
          <Row label="Poll interval" desc="how often HTTPRoutes are re-scanned (env: POLL_SECONDS)">
            <div style={{ display: "flex", gap: 4 }}>
              {intervals.map((v) => (
                <button
                  key={v}
                  onClick={() => setPoll(v)}
                  style={{
                    padding: "5px 10px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: poll === v ? "var(--text-on-accent)" : "var(--text-secondary)",
                    background: poll === v ? "var(--accent)" : "var(--bg-inset)",
                    border: "1px solid " + (poll === v ? "var(--accent)" : "var(--border-default)"),
                    borderRadius: "var(--radius-xs)",
                    cursor: "pointer",
                  }}
                >
                  {v}s
                </button>
              ))}
            </div>
          </Row>
          <Row label="All namespaces" desc="discover across the whole cluster">
            <Toggle on={scope.all} onClick={() => setScope((s) => ({ ...s, all: !s.all }))} />
          </Row>
          <Row label="Show hidden routes" desc="include app.megascope.io/hidden:true">
            <Toggle on={scope.hidden} onClick={() => setScope((s) => ({ ...s, hidden: !s.hidden }))} />
          </Row>
          <Row label="Probe ingress health" desc="active up/down + latency checks (env: PROBE_HEALTH)">
            <Toggle on={scope.ingress} onClick={() => setScope((s) => ({ ...s, ingress: !s.ingress }))} />
          </Row>
        </Panel>

        <Panel title="Annotation reference" corners meta="app.megascope.io/*">
          {(
            [
              ["name", "display name", "Grafana"],
              ["group", "category heading", "Monitoring"],
              ["icon", "tile glyph / lucide", "chart-spline"],
              ["url", "link override", "https://…"],
              ["hidden", "exclude from portal", "true"],
            ] as Array<[string, string, string]>
          ).map(([k, d, ex]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--cyan)" }}>/{k}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{d}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{ex}</span>
            </div>
          ))}
        </Panel>
      </div>

      <Panel title="Backend" corners>
        <div style={{ display: "flex", gap: 30, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
          <span>
            <span style={{ color: "var(--text-muted)" }}>endpoint</span> &nbsp;GET /api/routes
          </span>
          <span>
            <span style={{ color: "var(--text-muted)" }}>health</span> &nbsp;<span style={{ color: "var(--accent)" }}>GET /healthz · 200</span>
          </span>
          <span>
            <span style={{ color: "var(--text-muted)" }}>access</span> &nbsp;read-only ClusterRole
          </span>
          <span>
            <span style={{ color: "var(--text-muted)" }}>image</span> &nbsp;ghcr.io/your-org/megascope:latest
          </span>
        </div>
      </Panel>
    </div>
  );
}
