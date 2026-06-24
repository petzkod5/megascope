import { Panel } from "../components/Panel";
import { StatusDot } from "../components/StatusDot";
import { ActivityItem } from "../components/ActivityItem";
import type { Activity } from "../types";

export function DiscoveryFeed({ activity, lastScan }: { activity: Activity[]; lastScan: number }) {
  return (
    <Panel
      title="Discovery feed"
      meta={"scan +" + lastScan + "s"}
      corners
      bodyPadding="2px var(--gutter) 8px"
    >
      <div>
        {activity.length === 0 ? (
          <div style={{ padding: "16px 0", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>no activity yet — watching for changes…</div>
        ) : (
          activity.map((a, i) => (
            <ActivityItem key={i} time={a.time} event={a.event} target={a.target} namespace={a.namespace} fresh={i === 0} />
          ))
        )}
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
        <StatusDot status="discovering" size={6} />
        polling gateway.networking.k8s.io/v1 · HTTPRoutes
      </div>
    </Panel>
  );
}
