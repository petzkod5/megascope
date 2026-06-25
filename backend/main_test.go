package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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

func TestNormalizeLink(t *testing.T) {
	long := strings.Repeat("a", 121)
	cases := []struct {
		name    string
		in      Link
		wantErr bool
		wantURL string
	}{
		{"valid full", Link{Name: "Grafana", URL: "https://grafana.example.com", Icon: "gauge", Group: "Monitoring"}, false, "https://grafana.example.com"},
		{"missing name", Link{Name: "", URL: "x"}, true, ""},
		{"missing url", Link{Name: "x", URL: ""}, true, ""},
		{"scheme-less", Link{Name: "G", URL: "grafana.local"}, false, "https://grafana.local"},
		{"bad scheme", Link{Name: "G", URL: "ftp://x"}, true, ""},
		{"name too long", Link{Name: long, URL: "x"}, true, ""},
	}
	for _, c := range cases {
		got, err := normalizeLink(c.in)
		if c.wantErr {
			if err == nil {
				t.Errorf("%s: expected error, got nil (%+v)", c.name, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: unexpected error: %v", c.name, err)
			continue
		}
		if got.URL != c.wantURL {
			t.Errorf("%s: URL = %q, want %q", c.name, got.URL, c.wantURL)
		}
	}
}

func TestLinkStoreCRUD(t *testing.T) {
	s := newLinkStore("")
	a, _ := normalizeLink(Link{Name: "A", URL: "https://a.example.com"})
	a.ID = randID()
	b, _ := normalizeLink(Link{Name: "B", URL: "https://b.example.com"})
	b.ID = randID()
	if err := s.add(a); err != nil {
		t.Fatalf("add a: %v", err)
	}
	if err := s.add(b); err != nil {
		t.Fatalf("add b: %v", err)
	}
	ls := s.list()
	if len(ls) != 2 {
		t.Fatalf("list len = %d, want 2", len(ls))
	}
	for _, l := range ls {
		if l.ID == "" {
			t.Errorf("link %q has empty ID", l.Name)
		}
	}
	upd := a
	upd.Name = "A2"
	if ok, err := s.update(upd); err != nil || !ok {
		t.Fatalf("update existing: ok=%v err=%v", ok, err)
	}
	found := false
	for _, l := range s.list() {
		if l.ID == a.ID && l.Name == "A2" {
			found = true
		}
	}
	if !found {
		t.Error("update did not change name")
	}
	if ok, _ := s.update(Link{ID: "nope", Name: "x"}); ok {
		t.Error("update unknown returned found=true")
	}
	if ok, err := s.remove(a.ID); err != nil || !ok {
		t.Fatalf("remove existing: ok=%v err=%v", ok, err)
	}
	if len(s.list()) != 1 {
		t.Errorf("after remove len = %d, want 1", len(s.list()))
	}
	if ok, _ := s.remove("nope"); ok {
		t.Error("remove unknown returned found=true")
	}
}

func TestLinkStorePersistence(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "links.json")
	s := newLinkStore(path)
	l, _ := normalizeLink(Link{Name: "Grafana", URL: "https://grafana.example.com"})
	l.ID = randID()
	if err := s.add(l); err != nil {
		t.Fatalf("add: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected file at %s: %v", path, err)
	}
	s2 := newLinkStore(path)
	ls := s2.list()
	if len(ls) != 1 || ls[0].Name != "Grafana" {
		t.Fatalf("reloaded links = %+v, want one Grafana", ls)
	}
}

func TestLinksHTTP(t *testing.T) {
	mux := http.NewServeMux()
	registerLinkRoutes(mux, newLinkStore(""))
	srv := httptest.NewServer(mux)
	defer srv.Close()

	decode := func(r *http.Response) []Link {
		t.Helper()
		var body struct {
			Links []Link `json:"links"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode: %v", err)
		}
		r.Body.Close()
		return body.Links
	}

	resp, err := http.Post(srv.URL+"/api/links", "application/json", strings.NewReader(`{"name":"Grafana","url":"grafana.example.com"}`))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("POST status = %d, want 201", resp.StatusCode)
	}
	links := decode(resp)
	if len(links) != 1 || links[0].ID == "" || links[0].URL != "https://grafana.example.com" {
		t.Fatalf("POST body = %+v", links)
	}
	id := links[0].ID

	resp, err = http.Post(srv.URL+"/api/links", "application/json", strings.NewReader(`{"url":"x"}`))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("POST invalid status = %d, want 400", resp.StatusCode)
	}
	resp.Body.Close()

	resp, err = http.Get(srv.URL + "/api/links")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET status = %d, want 200", resp.StatusCode)
	}
	if got := decode(resp); len(got) != 1 {
		t.Fatalf("GET len = %d, want 1", len(got))
	}

	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/links/"+id, strings.NewReader(`{"name":"Graf2","url":"grafana.example.com"}`))
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("PUT status = %d, want 200", resp.StatusCode)
	}
	if got := decode(resp); len(got) != 1 || got[0].Name != "Graf2" {
		t.Fatalf("PUT body = %+v", got)
	}

	req, _ = http.NewRequest(http.MethodPut, srv.URL+"/api/links/does-not-exist", strings.NewReader(`{"name":"x","url":"x.example.com"}`))
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("PUT unknown status = %d, want 404", resp.StatusCode)
	}
	resp.Body.Close()

	req, _ = http.NewRequest(http.MethodDelete, srv.URL+"/api/links/"+id, nil)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("DELETE status = %d, want 200", resp.StatusCode)
	}
	if got := decode(resp); len(got) != 0 {
		t.Fatalf("DELETE body len = %d, want 0", len(got))
	}

	req, _ = http.NewRequest(http.MethodDelete, srv.URL+"/api/links/does-not-exist", nil)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("DELETE unknown status = %d, want 404", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestLinksHTTPBodyLimit(t *testing.T) {
	mux := http.NewServeMux()
	registerLinkRoutes(mux, newLinkStore(""))
	srv := httptest.NewServer(mux)
	defer srv.Close()

	// A body well over the 1 MiB MaxBytesReader cap is rejected before it can
	// exhaust memory; the decode fails and the handler returns 400.
	huge := `{"name":"` + strings.Repeat("a", 2<<20) + `","url":"x.example.com"}`
	resp, err := http.Post(srv.URL+"/api/links", "application/json", strings.NewReader(huge))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("oversized body status = %d, want 400", resp.StatusCode)
	}
}
