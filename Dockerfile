# syntax=docker/dockerfile:1

# ── Stage 1: build the React/TS frontend ──────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:26-alpine AS frontend
WORKDIR /app
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── Stage 2: build the Go backend (static binary) ─────────────────────────────
FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS backend
WORKDIR /src
COPY backend/go.mod ./
COPY backend/ ./
ARG TARGETOS TARGETARCH
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -ldflags="-s -w" -o /megascope .

# ── Stage 3: runtime (distroless, non-root) ───────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot AS runtime
WORKDIR /app
COPY --from=backend /megascope /app/megascope
COPY --from=frontend /app/dist /app/web
ENV WEB_DIR=/app/web ADDR=:8080
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/megascope"]
