# megascope

A homepage / portal for the **Rivendell** cluster. It auto-discovers Gateway API
**HTTPRoutes** and presents every app as a single dashboard — no manual config,
new apps appear on their own.

> In *The Witcher*, a megascope lets you see and reach people across great
> distances. This one does the same for your cluster.

## How it works

- **Backend (Go):** talks to the in-cluster Kubernetes API with its mounted
  ServiceAccount token (no client-go — a tiny dependency-free static binary),
  lists `HTTPRoute`s across all namespaces every 30s, and serves them at
  `GET /api/routes`. Also serves the built frontend and `GET /healthz`.
- **Frontend (React/TS, Vite):** fetches `/api/routes` and renders the portal —
  grouped, searchable tiles linking to each app's hostname.

Single image: the Go binary serves both the API and the static SPA.

## Customising a tile

Annotate an app's `HTTPRoute` to control how it appears (all optional):

```yaml
metadata:
  annotations:
    megascope.petzko.sh/name: "Grafana"      # display name (default: route name)
    megascope.petzko.sh/group: "Monitoring"  # category heading
    megascope.petzko.sh/icon: "📊"           # emoji/short label on the tile
    megascope.petzko.sh/url: "http://..."    # link override (default: http://<hostname>)
    megascope.petzko.sh/hidden: "true"       # exclude from the portal
```

## Develop

```bash
# terminal A — backend (needs a kubeconfig; discovery is skipped if absent)
cd backend && go run .            # :8080

# terminal B — frontend (proxies /api -> :8080)
cd frontend && npm install && npm run dev
```

## Build

```bash
docker build -t ghcr.io/petzkod5/megascope:latest .
```

## Deploy (Rivendell)

```bash
kubectl apply -f deploy/megascope.yaml
```

This creates the `megascope` namespace, a read-only `ClusterRole` for HTTPRoutes,
the Deployment/Service, and an HTTPRoute at `megascope.home.local`. (Or point an
ArgoCD Application at `deploy/`.)

## Notes

- Single-cluster (Rivendell) by design for now.
- The backend only ever **reads** HTTPRoutes; it has no write access.
