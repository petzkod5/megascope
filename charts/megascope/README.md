# megascope

![Version: 0.2.0](https://img.shields.io/badge/Version-0.2.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.2.0](https://img.shields.io/badge/AppVersion-0.2.0-informational?style=flat-square)

A self-hosted, auto-discovering homepage/portal for any Kubernetes cluster — it surfaces every Gateway API HTTPRoute as a command-center dashboard with live health.

**Homepage:** <https://github.com/petzkod5/megascope>

A command-center homepage for any Kubernetes cluster. megascope auto-discovers
Gateway API **HTTPRoutes** and renders each app as a status-led tile, with a live
cluster-health bar, per-route health probes, a discovery feed, and a per-app
detail view. No manual config — new routes appear on their own.

## TL;DR

```bash
helm install megascope ./charts/megascope \
  --namespace megascope --create-namespace \
  --set 'httproute.parentRefs[0].name=gateway' \
  --set 'httproute.parentRefs[0].namespace=gateway' \
  --set 'httproute.hostnames[0]=megascope.example.com'
```

Or install straight from the OCI registry (no clone needed):

```bash
helm install megascope oci://ghcr.io/petzkod5/charts/megascope \
  --version <X.Y.Z> --namespace megascope --create-namespace \
  --set 'httproute.parentRefs[0].name=<your-gateway>' \
  --set 'httproute.parentRefs[0].namespace=<gateway-ns>' \
  --set 'httproute.hostnames[0]=megascope.example.com'
```

> megascope needs a published image. Build and push one first:
> `docker build -t ghcr.io/petzkod5/megascope:latest . && docker push ghcr.io/petzkod5/megascope:latest`

## Prerequisites

- Kubernetes 1.23+
- The **Gateway API** CRDs and a Gateway (if using `httproute.enabled`, the
  default). Otherwise set `httproute.enabled=false` and use `ingress.enabled=true`.
- Helm 3.8+

## Installing

```bash
helm install megascope ./charts/megascope -n megascope --create-namespace -f my-values.yaml
```

A minimal `my-values.yaml`:

```yaml
image:
  repository: ghcr.io/petzkod5/megascope
  tag: latest

config:
  clusterName: rivendell

httproute:
  parentRefs:
    - name: traefik-gateway
      namespace: traefik
      sectionName: web
  hostnames:
    - megascope.home.local
```

## Exposing the portal

Pick **one** of:

- **Gateway API HTTPRoute** (default, `httproute.enabled=true`) — preferred, and
  it makes megascope appear in its own portal. Point `httproute.parentRefs` at
  your Gateway.
- **Ingress** (`ingress.enabled=true`, set `httproute.enabled=false`) — for
  clusters using an Ingress controller instead of Gateway API.
- **Neither** — port-forward the Service for local access (see `helm install` notes).

## How megascope customises tiles

Annotate any app's `HTTPRoute` (all optional):

| Annotation                | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `app.megascope.io/name`   | Display name (default: route name)        |
| `app.megascope.io/group`  | Category heading                          |
| `app.megascope.io/icon`   | lucide icon name (e.g. `chart-spline`) or emoji |
| `app.megascope.io/url`    | Link override (default: `http://<host>`)  |
| `app.megascope.io/hidden` | `"true"` to exclude from the portal       |

## Custom links

Beyond auto-discovered routes, users can add their own links from the UI — click
**Add link**, give it a name, URL (anything, including services outside the
cluster), an optional group, and pick an icon. Links render as tiles alongside
discovered apps and can be edited or removed (right-click a link tile → **Edit…**).

By default custom links are kept in memory and are lost when the pod restarts. To
persist and share them across everyone using the portal, enable a PersistentVolume:

```yaml
persistence:
  enabled: true
  size: 64Mi
  # storageClass: ""   # uses the cluster default
```

The claim is `ReadWriteOnce`, which a single pod can mount, so keep `replicaCount: 1`
and leave `autoscaling.enabled: false` (or provide a `ReadWriteMany` `storageClass`)
when persistence is on. The backend writes `links.json` under `persistence.mountPath`
(`/data` by default) as the non-root user (fsGroup `65532`).

## Metrics

The backend exposes Prometheus metrics at `GET /metrics` (route status & latency,
cluster summary, scan duration). To scrape it, add the usual annotations via
`podAnnotations`:

```yaml
podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"
  prometheus.io/path: /metrics
```

## High availability

megascope is stateless (each pod keeps its own discovery cache), so you can scale
the web layer freely:

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

## NetworkPolicy

Set `networkPolicy.enabled=true` (needs a CNI that enforces them). The defaults
allow ingress to the http port and egress for DNS + the API server + common probe
ports; override `networkPolicy.ingress` / `networkPolicy.egress` to tighten.

## Uninstalling

```bash
helm uninstall megascope -n megascope
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` | Affinity rules for pod scheduling. |
| autoscaling.enabled | bool | `false` | Enable a HorizontalPodAutoscaler. |
| autoscaling.maxReplicas | int | `3` | Maximum replicas. |
| autoscaling.minReplicas | int | `1` | Minimum replicas. |
| autoscaling.targetCPUUtilizationPercentage | int | `80` | Target average CPU utilization (%). Empty disables the CPU metric. |
| autoscaling.targetMemoryUtilizationPercentage | string | `""` | Target average memory utilization (%). Empty disables the memory metric. |
| config.clusterName | string | `"production"` | Cluster name shown in the top bar and health panel. |
| config.extraEnv | list | `[]` | Extra environment variables, in raw container `env` form (e.g. `- name: FOO` / `value: bar`, or `valueFrom:`). |
| config.pollSeconds | int | `30` | Discovery scan interval, in seconds. |
| config.probeHealth | bool | `true` | Probe each discovered route's URL to derive status (up/warn/down) and latency. Set to `false` to disable active probing. |
| fullnameOverride | string | `""` | Override the fully-qualified app name (used in resource names). |
| httproute.annotations | object | `{"app.megascope.io/group":"Platform","app.megascope.io/icon":"◎","app.megascope.io/name":"Megascope"}` | Annotations on the HTTPRoute. The `app.megascope.io/*` ones customise megascope's own tile. |
| httproute.enabled | bool | `true` | Create an HTTPRoute for megascope. |
| httproute.hostnames | list | `["megascope.example.com"]` | Hostnames megascope is served on. |
| httproute.parentRefs | list | `[{"name":"gateway","namespace":"gateway","sectionName":"web"}]` | `parentRefs` for the HTTPRoute — point these at your Gateway. |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy. |
| image.repository | string | `"ghcr.io/petzkod5/megascope"` | Image repository. Defaults to the chart's published image; override to point at a fork's image or a registry mirror. |
| image.tag | string | `""` | Image tag. Defaults to the chart's `appVersion` when empty. |
| imagePullSecrets | list | `[]` | Image pull secrets for private registries. |
| ingress.annotations | object | `{}` | Annotations for the Ingress. |
| ingress.className | string | `""` | IngressClass name. |
| ingress.enabled | bool | `false` | Create an Ingress. |
| ingress.hosts | list | `[{"host":"megascope.example.com","paths":[{"path":"/","pathType":"Prefix"}]}]` | Ingress hosts and their paths. |
| ingress.tls | list | `[]` | TLS configuration for the Ingress. |
| livenessProbe | object | `{"httpGet":{"path":"/healthz","port":"http"},"initialDelaySeconds":3,"periodSeconds":15}` | Liveness probe (override the whole block to customise). |
| nameOverride | string | `""` | Override the chart name (used in resource names). |
| networkPolicy.egress | list | `[]` | Egress rules. When empty, a default allows DNS plus TCP 80/443/6443/8080 (megascope must reach the API server and probe route hosts). Tighten as needed for your environment. |
| networkPolicy.enabled | bool | `false` | Create a NetworkPolicy. Requires a CNI that enforces them (Cilium, Calico, …). |
| networkPolicy.ingress | list | `[]` | Ingress rules. When empty, a default rule allows traffic to the http port from any source (so your Gateway/Ingress can reach it). |
| nodeSelector | object | `{}` | Node selector for pod scheduling. |
| persistence.accessMode | string | `"ReadWriteOnce"` | Access mode for the created PVC. |
| persistence.enabled | bool | `false` | Persist custom links to a PersistentVolume. The default ReadWriteOnce claim cannot be shared across pods, so keep replicaCount=1 and autoscaling disabled when this is on (or supply a ReadWriteMany storageClass). |
| persistence.existingClaim | string | `""` | Use an existing PersistentVolumeClaim instead of creating one. |
| persistence.mountPath | string | `"/data"` | Mount path for the links data. LINKS_FILE is set to <mountPath>/links.json. |
| persistence.size | string | `"64Mi"` | Storage requested for the created PVC. |
| persistence.storageClass | string | `""` | StorageClass for the created PVC. "" uses the cluster default. |
| podAnnotations | object | `{}` | Annotations added to the Pod. |
| podDisruptionBudget.enabled | bool | `false` | Create a PodDisruptionBudget (only meaningful with >1 replica). |
| podDisruptionBudget.maxUnavailable | string | `""` | Maximum unavailable pods. Set this OR minAvailable, not both. |
| podDisruptionBudget.minAvailable | int | `1` | Minimum available pods (mutually exclusive with maxUnavailable). |
| podLabels | object | `{}` | Labels added to the Pod. |
| podSecurityContext | object | `{"fsGroup":65532,"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}` | Pod-level security context. |
| podSecurityContext.fsGroup | int | `65532` | fsGroup so a mounted PVC is group-writable by the distroless nonroot user (uid/gid 65532). Harmless when no volume is mounted. |
| rbac.create | bool | `true` | Create the read-only ClusterRole + ClusterRoleBinding megascope needs (HTTPRoutes for discovery; nodes/pods/namespaces for the health summary). Disable if you manage RBAC out-of-band. |
| readinessProbe | object | `{"httpGet":{"path":"/healthz","port":"http"},"initialDelaySeconds":2,"periodSeconds":10}` | Readiness probe (override the whole block to customise). |
| replicaCount | int | `1` | Number of replicas. megascope's discovery cache is per-pod, so a single replica is plenty; scale up only for HA of the (stateless) web layer. |
| resources | object | `{"limits":{"cpu":"200m","memory":"64Mi"},"requests":{"cpu":"10m","memory":"32Mi"}}` | Resource requests and limits. |
| securityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true}` | Container-level security context. megascope runs read-only with no extra capabilities. |
| service.port | int | `80` | Service port. |
| service.type | string | `"ClusterIP"` | Service type. |
| serviceAccount.annotations | object | `{}` | Annotations to add to the ServiceAccount. |
| serviceAccount.create | bool | `true` | Create a ServiceAccount for megascope. |
| serviceAccount.name | string | `""` | Name of the ServiceAccount. Generated from the fullname when empty. |
| tolerations | list | `[]` | Tolerations for pod scheduling. |

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| Dylan Petzko |  | <https://github.com/petzkod5> |

## Source Code

* <https://github.com/petzkod5/megascope>

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.14.2](https://github.com/norwoodj/helm-docs/releases/v1.14.2)
