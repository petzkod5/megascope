<!-- Thanks for contributing to megascope! -->

## What & why

<!-- What does this change do, and why? Link any related issue. -->

Closes #

## Checklist

- [ ] `go vet ./... && go test ./...` pass (backend)
- [ ] `npm run build` passes (frontend)
- [ ] `helm lint charts/megascope` passes (if the chart changed)
- [ ] Regenerated the chart README with `helm-docs` (if `values.yaml` changed)
- [ ] No hardcoded cluster/gateway/registry names (kept agnostic)
