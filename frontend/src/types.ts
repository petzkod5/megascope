/* Shared types — mirror the Go backend's /api/routes payload (State). */

export type Status = "up" | "down" | "warn" | "discovering" | "unknown";

export interface ParentRef {
  name?: string;
  namespace?: string;
  sectionName?: string;
}

export interface Route {
  name: string;
  namespace: string;
  host: string;
  hostnames: string[];
  url: string;
  group?: string;
  icon?: string;
  parentRefs?: ParentRef[];
  backend?: string;
  status: Status;
  latency?: number | null;
  history?: number[]; // recent latency samples from the backend
  version?: string; // not currently emitted by the backend; optional
}

export interface Cluster {
  name: string;
  version?: string;
  nodes: number;
  nodesReady: number;
  pods: number;
  namespaces: number;
  cpu?: number | null;
  memory?: number | null;
  ingress?: number | null;
  p95?: number | null;
}

export interface Activity {
  time: string;
  event: string;
  target: string;
  namespace: string;
}

export interface State {
  cluster: Cluster;
  routes: Route[];
  activity: Activity[];
  updated_at: number;
  discovering: boolean;
}
