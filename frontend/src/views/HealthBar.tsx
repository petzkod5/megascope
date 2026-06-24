import type { JSX } from "react";
import { Panel } from "../components/Panel";
import { Badge } from "../components/Badge";
import { StatReadout } from "../components/StatReadout";
import { Meter } from "../components/Meter";
import type { Cluster } from "../types";

export function HealthBar({ c, downCount }: { c: Cluster; downCount: number }) {
  const meters: Array<{ key: string; node: JSX.Element }> = [];
  if (c.cpu != null) meters.push({ key: "cpu", node: <Meter label="CPU" value={c.cpu} auto /> });
  if (c.memory != null) meters.push({ key: "mem", node: <Meter label="Memory" value={c.memory} auto /> });
  if (c.ingress != null) meters.push({ key: "ing", node: <Meter label="Ingress" value={c.ingress} tone="cyan" /> });

  const p95 = c.p95;
  const badge =
    downCount > 0 ? (
      <Badge tone="down" dot>
        {downCount} down
      </Badge>
    ) : (
      <Badge tone="up" dot>
        operational
      </Badge>
    );

  return (
    <Panel title="Cluster health" meta={c.version} corners actions={badge}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: meters.length ? "repeat(4, auto) 1fr" : "repeat(4, auto)",
          gap: 30,
          alignItems: "center",
        }}
      >
        <StatReadout label="Nodes" value={c.nodesReady + "/" + c.nodes} tone="accent" glow />
        <StatReadout label="Pods" value={c.pods} unit="running" />
        <StatReadout label="Namespaces" value={c.namespaces} />
        <StatReadout label="p95 latency" value={p95 != null ? p95 : "—"} unit={p95 != null ? "ms" : undefined} tone={p95 != null && p95 > 60 ? "amber" : "accent"} />
        {meters.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 24, borderLeft: "1px solid var(--border-subtle)" }}>
            {meters.map((m) => (
              <div key={m.key}>{m.node}</div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
