# Contributing to megascope

Thanks for your interest! megascope is a small, dependency-light project — a Go
backend and a React/TypeScript frontend, served as a single container.

## Project layout

```
backend/    Go API + k8s discovery/health (stdlib only, no client-go)
frontend/   React + TypeScript + Vite (the command-center UI)
charts/     Helm chart (parameterized deploy)
Dockerfile  multi-stage: build frontend → build backend → distroless
```

## Develop locally

The backend reads the cluster the in-cluster way, so point it at `kubectl proxy`:

```bash
# terminal A — proxy the cluster API (uses your kubeconfig)
kubectl proxy --port=8001

# terminal B — backend
cd backend && KUBE_API=http://localhost:8001 go run .   # :8080

# terminal C — frontend (proxies /api -> :8080)
cd frontend && npm install && npm run dev
```

Without `KUBE_API` the backend still serves but discovery is disabled (handy for
UI-only work).

## Before opening a PR

Run what CI runs:

```bash
# backend
cd backend && go vet ./... && go test ./... && go build ./...

# frontend
cd frontend && npm ci && npm run build      # build runs `tsc --noEmit` first

# chart
helm lint charts/megascope
```

If you change `charts/megascope/values.yaml`, regenerate the chart README:

```bash
helm-docs --chart-search-root=charts --template-files=README.md.gotmpl
```

## Guidelines

- Keep the backend dependency-free (stdlib only).
- Match the existing style; the UI follows the bundled design tokens
  (`frontend/src/index.css`).
- Keep changes cluster-agnostic — no hardcoded cluster/gateway/registry names.
- Small, focused PRs with a clear description are easiest to review.

### Commit messages & releases

Releases are automated by [`release.yml`](.github/workflows/release.yml) using
[release-please](https://github.com/googleapis/release-please). It reads the
[Conventional Commits](https://www.conventionalcommits.org/) that land on `main`
and keeps an open **release PR** that bumps the version + `CHANGELOG.md`; merging
that PR tags the release and publishes the image + chart.

- `feat:` — a new feature → **minor** bump (`0.1.0` → `0.2.0`).
- `fix:` / `perf:` — a bug/perf fix → **patch** bump (`0.1.0` → `0.1.1`).
- A `BREAKING CHANGE:` footer or a `!` (e.g. `feat!:`) → also a **minor** bump
  while pre-1.0 (we stay in 0.x until an intentional `1.0.0`).
- `chore:`, `ci:`, `docs:`, `refactor:`, `test:`, `build:`, `style:` → no release.

**Never bump versions by hand** — `charts/megascope/Chart.yaml` and
`frontend/package.json` (+ lockfile) are updated by release-please in the release
PR. (The rendered `charts/megascope/README.md` badges come from `helm-docs`, not
release-please; regenerate them as noted above.) When **squash-merging** a
feature/fix PR, the squash commit title must be a conventional message: it is
what release-please reads to compute the next version.

By contributing you agree your contributions are licensed under the project's
[MIT License](LICENSE).
