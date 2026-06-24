package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestParseCPU(t *testing.T) {
	cases := map[string]float64{
		"":      0,
		"100m":  100,
		"1500m": 1500,
		"2":     2000,
		"0.5":   500,
	}
	for in, want := range cases {
		if got := parseCPU(in); got != want {
			t.Errorf("parseCPU(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestParseMem(t *testing.T) {
	cases := map[string]float64{
		"":      0,
		"512Mi": 512 * 1024 * 1024,
		"8Gi":   8 * 1024 * 1024 * 1024,
		"1Ki":   1024,
		"1000":  1000,
		"1M":    1_000_000,
	}
	for in, want := range cases {
		if got := parseMem(in); got != want {
			t.Errorf("parseMem(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestPct(t *testing.T) {
	if pct(5, 0) != nil {
		t.Error("pct with zero whole should be nil")
	}
	if got := pct(25, 100); got == nil || *got != 25 {
		t.Errorf("pct(25,100) = %v, want 25", got)
	}
	if got := pct(200, 100); got == nil || *got != 100 {
		t.Errorf("pct should clamp to 100, got %v", got)
	}
}

func TestDiffFirstScanSeedsOnly(t *testing.T) {
	routes := []Route{{Name: "a", Namespace: "ns", Status: "up"}}
	events, cur := diff(map[string]string{}, routes, true)
	if len(events) != 0 {
		t.Errorf("first scan should emit no events, got %d", len(events))
	}
	if cur["ns/a"] != "up" {
		t.Errorf("first scan should seed status map, got %v", cur)
	}
}

func TestDiffDiscoverAndRemove(t *testing.T) {
	prev := map[string]string{"ns/old": "up"}
	routes := []Route{{Name: "new", Namespace: "ns", Status: "up"}}
	events, _ := diff(prev, routes, false)
	var discovered, removed bool
	for _, e := range events {
		if e.Event == "discovered" && e.Namespace == "ns" {
			discovered = true
		}
		if e.Event == "removed" {
			removed = true
		}
	}
	if !discovered {
		t.Error("expected a discovered event for the new route")
	}
	if !removed {
		t.Error("expected a removed event for the gone route")
	}
}

func TestDiffStatusChange(t *testing.T) {
	prev := map[string]string{"ns/a": "up"}
	routes := []Route{{Name: "a", Namespace: "ns", Status: "down"}}
	events, _ := diff(prev, routes, false)
	if len(events) != 1 || events[0].Event != "degraded" {
		t.Errorf("up->down should be 'degraded', got %v", events)
	}

	prev = map[string]string{"ns/a": "down"}
	routes = []Route{{Name: "a", Namespace: "ns", Status: "up"}}
	events, _ = diff(prev, routes, false)
	if len(events) != 1 || events[0].Event != "updated" {
		t.Errorf("down->up should be 'updated', got %v", events)
	}
}

func TestRecordHistory(t *testing.T) {
	histories := map[string][]int{}
	lat := func(v int) *int { return &v }

	recordHistory(histories, []Route{{Name: "a", Namespace: "ns", Latency: lat(10)}})
	recordHistory(histories, []Route{{Name: "a", Namespace: "ns", Latency: lat(20)}})
	routes := []Route{{Name: "a", Namespace: "ns", Latency: lat(30)}}
	recordHistory(histories, routes)

	if got := routes[0].History; len(got) != 3 || got[0] != 10 || got[2] != 30 {
		t.Errorf("history = %v, want [10 20 30]", got)
	}

	// A route that disappears should have its buffer pruned.
	recordHistory(histories, []Route{{Name: "b", Namespace: "ns", Latency: lat(5)}})
	if _, ok := histories["ns/a"]; ok {
		t.Error("expected ns/a history to be pruned after it vanished")
	}
}

func TestRenderMetrics(t *testing.T) {
	cpu := 42
	lat := 12
	st := State{
		Cluster: Cluster{Nodes: 3, NodesReady: 3, Pods: 50, Namespaces: 7, CPU: &cpu},
		Routes: []Route{
			{Name: "grafana", Namespace: "monitoring", Status: "up", Latency: &lat},
			{Name: "old", Namespace: "default", Status: "down"},
		},
		UpdatedAt: 1_700_000_000_000,
	}
	out := renderMetrics(st, true, 250)

	for _, want := range []string{
		"megascope_up 1",
		"megascope_scan_duration_seconds 0.25",
		`megascope_routes{status="up"} 1`,
		`megascope_routes{status="down"} 1`,
		"megascope_cluster_nodes 3",
		"megascope_cluster_cpu_percent 42",
		`megascope_route_latency_milliseconds{namespace="monitoring",name="grafana"} 12`,
		`megascope_route_up{namespace="default",name="old"} 0`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("metrics output missing %q\n---\n%s", want, out)
		}
	}
}

func TestProbe(t *testing.T) {
	client := newProbeClient()

	// Empty URL -> unknown, no latency.
	if st, lat := probe(client, ""); st != "unknown" || lat != nil {
		t.Errorf("empty url: got (%q, %v), want (unknown, nil)", st, lat)
	}

	// A reachable server (any status code) -> up with a latency.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized) // 401 still means "reachable"
	}))
	defer srv.Close()
	if st, lat := probe(client, srv.URL); st != "up" || lat == nil {
		t.Errorf("reachable 401: got (%q, %v), want (up, non-nil)", st, lat)
	}

	// An unreachable endpoint -> down.
	srv.Close()
	if st, _ := probe(client, srv.URL); st != "down" {
		t.Errorf("closed server: got %q, want down", st)
	}
}
