// megascope — a self-hosted homepage/portal for any Kubernetes cluster. Auto-discovers
// Gateway API HTTPRoutes via the in-cluster Kubernetes API and serves them as a
// single command-center dashboard. Dependency-free: talks to the API directly
// with the mounted ServiceAccount token (no client-go), so it's a tiny static
// binary.
//
// Beyond discovery it derives the runtime data the portal renders:
//   - a cluster summary (nodes, pods, namespaces, version, CPU/mem commitment)
//   - per-route health (status + latency) from lightweight HTTP probes
//   - a live activity feed from scan-to-scan diffs
//
// Apps customise their tile with annotations on the HTTPRoute:
//
//	app.megascope.io/name   display name (default: route name)
//	app.megascope.io/group  group/category heading
//	app.megascope.io/icon   emoji or lucide icon name shown on the tile
//	app.megascope.io/url    override link (default: http://<first hostname>)
//	app.megascope.io/hidden "true" to exclude from the portal
package main

import (
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	tokenPath      = "/var/run/secrets/kubernetes.io/serviceaccount/token"
	caPath         = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
	apiHost        = "https://kubernetes.default.svc"
	httpRoutesPath = "/apis/gateway.networking.k8s.io/v1/httproutes"
	annPrefix      = "app.megascope.io/"
	activityMax    = 24
	warnLatencyMs  = 800
	historyCap     = 32

	maxLinks    = 200
	maxNameLen  = 120
	maxURLLen   = 2048
	maxIconLen  = 64
	maxGroupLen = 64
)

// ParentRef is a Gateway (or other parent) an HTTPRoute attaches to.
type ParentRef struct {
	Name        string `json:"name,omitempty"`
	Namespace   string `json:"namespace,omitempty"`
	SectionName string `json:"sectionName,omitempty"`
}

// Route is one discovered app, enriched with runtime health, as served to the
// frontend.
type Route struct {
	Name       string      `json:"name"`
	Namespace  string      `json:"namespace"`
	Host       string      `json:"host"`
	Hostnames  []string    `json:"hostnames"`
	URL        string      `json:"url"`
	Group      string      `json:"group,omitempty"`
	Icon       string      `json:"icon,omitempty"`
	ParentRefs []ParentRef `json:"parentRefs,omitempty"` // Gateways this route attaches to
	Backend    string      `json:"backend,omitempty"`    // first backendRef, "svc:port"
	Status     string      `json:"status"`               // up | warn | down | unknown
	Latency    *int        `json:"latency,omitempty"`    // ms; nil when unknown
	History    []int       `json:"history,omitempty"`    // recent latency samples (server-side)
}

// Cluster is the high-level summary shown in the health bar. Pointer fields are
// omitted when their source is unavailable so the UI can degrade gracefully.
type Cluster struct {
	Name       string `json:"name"`
	Version    string `json:"version,omitempty"`
	Nodes      int    `json:"nodes"`
	NodesReady int    `json:"nodesReady"`
	Pods       int    `json:"pods"`
	Namespaces int    `json:"namespaces"`
	CPU        *int   `json:"cpu,omitempty"`     // % committed (requests/allocatable)
	Memory     *int   `json:"memory,omitempty"`  // % committed
	Ingress    *int   `json:"ingress,omitempty"` // reserved; no source yet
	P95        *int   `json:"p95,omitempty"`     // ms, 95th pct of probe latencies
}

// Activity is one line in the discovery feed.
type Activity struct {
	Time      string `json:"time"` // HH:MM:SS
	Event     string `json:"event"`
	Target    string `json:"target"`
	Namespace string `json:"namespace"`
}

// State is the full payload the portal polls.
type State struct {
	Cluster     Cluster    `json:"cluster"`
	Routes      []Route    `json:"routes"`
	Activity    []Activity `json:"activity"`
	UpdatedAt   int64      `json:"updated_at"`
	Discovering bool       `json:"discovering"`
	Links       []Link     `json:"links"`
}

// Link is a user-defined custom link (a bookmark tile), persisted server-side
// and shared by everyone using the portal. Unlike Route it carries no health.
type Link struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	URL   string `json:"url"`
	Icon  string `json:"icon,omitempty"`
	Group string `json:"group,omitempty"`
}

type store struct {
	mu     sync.RWMutex
	state  State
	scanMs int64
	ok     bool
}

func (s *store) set(st State, scanMs int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state, s.scanMs, s.ok = st, scanMs, true
}

func (s *store) snapshot() (State, int64, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state, s.scanMs, s.ok
}

// ---- custom links (file-backed) --------------------------------------------

var errTooManyLinks = errors.New("link limit reached")

type linkStore struct {
	mu    sync.RWMutex
	path  string // "" => in-memory only (no persistence)
	links []Link
}

// newLinkStore loads existing links from path (best-effort; a missing file is
// fine, a parse error logs and starts empty). path "" disables persistence.
func newLinkStore(path string) *linkStore {
	s := &linkStore{path: path}
	if path == "" {
		return s
	}
	b, err := os.ReadFile(path)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("links: read %s: %v", path, err)
		}
		return s
	}
	var ls []Link
	if err := json.Unmarshal(b, &ls); err != nil {
		log.Printf("links: parse %s: %v", path, err)
		return s
	}
	s.links = ls
	return s
}

func (s *linkStore) list() []Link {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]Link{}, s.links...)
}

// persist atomically writes links to disk (temp file + rename). No-op when path is "".
func (s *linkStore) persist(links []Link) error {
	if s.path == "" {
		return nil
	}
	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".links-*.json")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	enc := json.NewEncoder(tmp)
	enc.SetIndent("", "  ")
	if err := enc.Encode(links); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmp.Name(), s.path); err != nil {
		return err
	}
	// Best-effort fsync of the parent directory so the rename (the new directory
	// entry) survives a crash/power loss; failure here doesn't undo the write.
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}

// add appends an already-normalized link (with ID set). Memory is updated only
// after a successful persist, so disk and memory never diverge.
func (s *linkStore) add(l Link) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.links) >= maxLinks {
		return errTooManyLinks
	}
	next := append(append([]Link{}, s.links...), l)
	if err := s.persist(next); err != nil {
		return err
	}
	s.links = next
	return nil
}

// update replaces the link whose ID == l.ID. Returns found=false if absent.
func (s *linkStore) update(l Link) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := append([]Link{}, s.links...)
	idx := -1
	for i := range next {
		if next[i].ID == l.ID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return false, nil
	}
	next[idx] = l
	if err := s.persist(next); err != nil {
		return false, err
	}
	s.links = next
	return true, nil
}

// remove deletes the link with the given id. Returns found=false if absent.
func (s *linkStore) remove(id string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := make([]Link, 0, len(s.links))
	found := false
	for _, l := range s.links {
		if l.ID == id {
			found = true
			continue
		}
		next = append(next, l)
	}
	if !found {
		return false, nil
	}
	if err := s.persist(next); err != nil {
		return false, err
	}
	s.links = next
	return true, nil
}

func randID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 16)
	}
	return hex.EncodeToString(b[:])
}

// normalizeLink trims/validates a client-supplied link. The ID is assigned by
// the caller (add) or carried from the path (update). A scheme-less URL gets
// https:// prepended so users can type "grafana.example.com".
func normalizeLink(in Link) (Link, error) {
	name := strings.TrimSpace(in.Name)
	raw := strings.TrimSpace(in.URL)
	icon := strings.TrimSpace(in.Icon)
	group := strings.TrimSpace(in.Group)
	if name == "" {
		return Link{}, errors.New("name is required")
	}
	if raw == "" {
		return Link{}, errors.New("url is required")
	}
	if len(name) > maxNameLen || len(raw) > maxURLLen || len(icon) > maxIconLen || len(group) > maxGroupLen {
		return Link{}, errors.New("field too long")
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return Link{}, errors.New("invalid url")
	}
	return Link{Name: name, URL: u.String(), Icon: icon, Group: group}, nil
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// k8s wraps the Kubernetes API connection.
type k8s struct {
	client *http.Client
	token  string
	base   string
}

// newK8s builds a client for the Kubernetes API. In-cluster it trusts the
// mounted CA and uses the SA token. For local testing, set KUBE_API (e.g.
// http://localhost:8001 from `kubectl proxy`) — no TLS/token needed.
func newK8s() (*k8s, error) {
	if base := os.Getenv("KUBE_API"); base != "" {
		return &k8s{client: &http.Client{Timeout: 10 * time.Second}, base: strings.TrimRight(base, "/")}, nil
	}
	ca, err := os.ReadFile(caPath)
	if err != nil {
		return nil, fmt.Errorf("read ca: %w", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		return nil, fmt.Errorf("parse ca")
	}
	token, err := os.ReadFile(tokenPath)
	if err != nil {
		return nil, fmt.Errorf("read token: %w", err)
	}
	client := &http.Client{
		Timeout:   10 * time.Second,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}},
	}
	return &k8s{client: client, token: strings.TrimSpace(string(token)), base: apiHost}, nil
}

// get fetches and decodes a Kubernetes API path into v.
func (k *k8s) get(path string, v any) error {
	req, _ := http.NewRequest(http.MethodGet, k.base+path, nil)
	if k.token != "" {
		req.Header.Set("Authorization", "Bearer "+k.token)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := k.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("kubernetes api %s: %s", path, resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(v)
}

// ---- discovery -------------------------------------------------------------

func (k *k8s) routes() ([]Route, error) {
	var list struct {
		Items []struct {
			Metadata struct {
				Name        string            `json:"name"`
				Namespace   string            `json:"namespace"`
				Annotations map[string]string `json:"annotations"`
			} `json:"metadata"`
			Spec struct {
				Hostnames  []string `json:"hostnames"`
				ParentRefs []struct {
					Name        string `json:"name"`
					Namespace   string `json:"namespace"`
					SectionName string `json:"sectionName"`
				} `json:"parentRefs"`
				Rules []struct {
					BackendRefs []struct {
						Name string `json:"name"`
						Port int    `json:"port"`
					} `json:"backendRefs"`
				} `json:"rules"`
			} `json:"spec"`
		} `json:"items"`
	}
	if err := k.get(httpRoutesPath, &list); err != nil {
		return nil, err
	}

	routes := make([]Route, 0, len(list.Items))
	for _, it := range list.Items {
		ann := it.Metadata.Annotations
		if ann[annPrefix+"hidden"] == "true" {
			continue
		}
		name := ann[annPrefix+"name"]
		if name == "" {
			name = it.Metadata.Name
		}
		host := ""
		if len(it.Spec.Hostnames) > 0 {
			host = it.Spec.Hostnames[0]
		}
		url := ann[annPrefix+"url"]
		if url == "" && host != "" {
			url = "http://" + host
		}
		var parents []ParentRef
		for _, p := range it.Spec.ParentRefs {
			parents = append(parents, ParentRef{Name: p.Name, Namespace: p.Namespace, SectionName: p.SectionName})
		}
		backend := ""
		for _, rule := range it.Spec.Rules {
			if len(rule.BackendRefs) > 0 {
				b := rule.BackendRefs[0]
				backend = b.Name
				if b.Port != 0 {
					backend += ":" + strconv.Itoa(b.Port)
				}
				break
			}
		}
		routes = append(routes, Route{
			Name:       name,
			Namespace:  it.Metadata.Namespace,
			Host:       host,
			Hostnames:  it.Spec.Hostnames,
			URL:        url,
			Group:      ann[annPrefix+"group"],
			Icon:       ann[annPrefix+"icon"],
			ParentRefs: parents,
			Backend:    backend,
			Status:     "unknown",
		})
	}
	sort.Slice(routes, func(i, j int) bool {
		if routes[i].Group != routes[j].Group {
			return routes[i].Group < routes[j].Group
		}
		return strings.ToLower(routes[i].Name) < strings.ToLower(routes[j].Name)
	})
	return routes, nil
}

// ---- cluster summary -------------------------------------------------------

// parseCPU returns millicores from a Kubernetes CPU quantity ("100m", "2").
func parseCPU(s string) float64 {
	if s == "" {
		return 0
	}
	if strings.HasSuffix(s, "m") {
		v, _ := strconv.ParseFloat(strings.TrimSuffix(s, "m"), 64)
		return v
	}
	v, _ := strconv.ParseFloat(s, 64)
	return v * 1000
}

// parseMem returns bytes from a Kubernetes memory quantity ("512Mi", "8Gi").
func parseMem(s string) float64 {
	if s == "" {
		return 0
	}
	mult := []struct {
		suf string
		f   float64
	}{
		{"Ki", 1 << 10}, {"Mi", 1 << 20}, {"Gi", 1 << 30}, {"Ti", 1 << 40}, {"Pi", 1 << 50},
		{"k", 1e3}, {"M", 1e6}, {"G", 1e9}, {"T", 1e12},
	}
	for _, m := range mult {
		if strings.HasSuffix(s, m.suf) {
			v, _ := strconv.ParseFloat(strings.TrimSuffix(s, m.suf), 64)
			return v * m.f
		}
	}
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

func pct(part, whole float64) *int {
	if whole <= 0 {
		return nil
	}
	p := int(part / whole * 100)
	if p < 0 {
		p = 0
	}
	if p > 100 {
		p = 100
	}
	return &p
}

// cluster gathers the health-bar summary. Every sub-query is best-effort: a
// failure leaves that field at its zero value (or nil) rather than failing the
// whole scan.
func (k *k8s) cluster(name string, latencies []int) Cluster {
	c := Cluster{Name: name}

	var ver struct {
		GitVersion string `json:"gitVersion"`
	}
	if err := k.get("/version", &ver); err == nil {
		c.Version = ver.GitVersion
	}

	var ns struct {
		Items []json.RawMessage `json:"items"`
	}
	if err := k.get("/api/v1/namespaces", &ns); err == nil {
		c.Namespaces = len(ns.Items)
	}

	var nodes struct {
		Items []struct {
			Status struct {
				Allocatable map[string]string `json:"allocatable"`
				Conditions  []struct {
					Type   string `json:"type"`
					Status string `json:"status"`
				} `json:"conditions"`
			} `json:"status"`
		} `json:"items"`
	}
	var allocCPU, allocMem float64
	if err := k.get("/api/v1/nodes", &nodes); err == nil {
		c.Nodes = len(nodes.Items)
		for _, n := range nodes.Items {
			for _, cond := range n.Status.Conditions {
				if cond.Type == "Ready" && cond.Status == "True" {
					c.NodesReady++
				}
			}
			allocCPU += parseCPU(n.Status.Allocatable["cpu"])
			allocMem += parseMem(n.Status.Allocatable["memory"])
		}
	}

	var pods struct {
		Items []struct {
			Status struct {
				Phase string `json:"phase"`
			} `json:"status"`
			Spec struct {
				Containers []struct {
					Resources struct {
						Requests map[string]string `json:"requests"`
					} `json:"resources"`
				} `json:"containers"`
			} `json:"spec"`
		} `json:"items"`
	}
	var reqCPU, reqMem float64
	if err := k.get("/api/v1/pods", &pods); err == nil {
		for _, p := range pods.Items {
			if p.Status.Phase == "Succeeded" || p.Status.Phase == "Failed" {
				continue
			}
			c.Pods++
			for _, ct := range p.Spec.Containers {
				reqCPU += parseCPU(ct.Resources.Requests["cpu"])
				reqMem += parseMem(ct.Resources.Requests["memory"])
			}
		}
	}
	c.CPU = pct(reqCPU, allocCPU)
	c.Memory = pct(reqMem, allocMem)

	if len(latencies) > 0 {
		sorted := append([]int(nil), latencies...)
		sort.Ints(sorted)
		idx := (len(sorted)*95 + 99) / 100 // ceil(0.95*n)
		if idx > len(sorted) {
			idx = len(sorted)
		}
		p95 := sorted[idx-1]
		c.P95 = &p95
	}
	return c
}

// ---- health probes ---------------------------------------------------------

func newProbeClient() *http.Client {
	return &http.Client{
		Timeout: 2500 * time.Millisecond,
		Transport: &http.Transport{
			TLSClientConfig:     &tls.Config{InsecureSkipVerify: true}, // homelab self-signed
			DisableKeepAlives:   true,
			MaxIdleConnsPerHost: -1,
		},
	}
}

// probe does a single GET and classifies reachability. Any HTTP response (even
// 401/403/redirect) means the route is reachable ("up"); slow responses are
// "warn"; transport errors are "down".
func probe(client *http.Client, url string) (string, *int) {
	if url == "" {
		return "unknown", nil
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "down", nil
	}
	req.Header.Set("User-Agent", "megascope-probe/1")
	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return "down", nil
	}
	resp.Body.Close()
	ms := int(time.Since(start).Milliseconds())
	status := "up"
	if ms > warnLatencyMs {
		status = "warn"
	}
	return status, &ms
}

// probeAll fills Status/Latency for every route concurrently and returns the
// observed latencies (for p95).
func probeAll(routes []Route) []int {
	client := newProbeClient()
	var wg sync.WaitGroup
	var mu sync.Mutex
	var latencies []int
	for i := range routes {
		wg.Add(1)
		go func(r *Route) {
			defer wg.Done()
			st, lat := probe(client, r.URL)
			r.Status, r.Latency = st, lat
			if lat != nil {
				mu.Lock()
				latencies = append(latencies, *lat)
				mu.Unlock()
			}
		}(&routes[i])
	}
	wg.Wait()
	return latencies
}

// ---- activity feed ---------------------------------------------------------

// diff compares the previous status map with the current routes and returns new
// activity lines (newest first), plus the updated status map. On the first scan
// it only seeds the map (no "discovered" spam for the initial inventory).
func diff(prev map[string]string, routes []Route, first bool) ([]Activity, map[string]string) {
	now := time.Now().Format("15:04:05")
	cur := make(map[string]string, len(routes))
	seen := make(map[string]bool, len(routes))
	var out []Activity
	for _, r := range routes {
		key := r.Namespace + "/" + r.Name
		cur[key] = r.Status
		seen[key] = true
		target := strings.ToLower(r.Name) + "." + r.Namespace
		old, existed := prev[key]
		switch {
		case !existed:
			if !first {
				out = append(out, Activity{now, "discovered", target, r.Namespace})
			}
		case old != r.Status:
			ev := "updated"
			if r.Status == "warn" || r.Status == "down" {
				ev = "degraded"
			}
			out = append(out, Activity{now, ev, target, r.Namespace})
		}
	}
	for key := range prev {
		if !seen[key] {
			parts := strings.SplitN(key, "/", 2)
			ns, name := parts[0], ""
			if len(parts) == 2 {
				name = parts[1]
			}
			out = append(out, Activity{now, "removed", strings.ToLower(name) + "." + ns, ns})
		}
	}
	return out, cur
}

// recordHistory appends each route's latency to a persistent ring buffer (capped
// at historyCap) and stamps a copy onto the route, so the detail sparkline has a
// real time series that survives client reloads. Buffers for vanished routes are
// pruned.
func recordHistory(histories map[string][]int, routes []Route) {
	live := make(map[string]bool, len(routes))
	for i := range routes {
		r := &routes[i]
		key := r.Namespace + "/" + r.Name
		live[key] = true
		if r.Latency == nil {
			continue
		}
		h := append(histories[key], *r.Latency)
		if len(h) > historyCap {
			h = h[len(h)-historyCap:]
		}
		histories[key] = h
		r.History = append([]int(nil), h...) // copy: decouple from later appends
	}
	for key := range histories {
		if !live[key] {
			delete(histories, key)
		}
	}
}

// ---- metrics (Prometheus text exposition) ----------------------------------

// metricLabel escapes a Prometheus label value.
func metricLabel(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`)
	return r.Replace(s)
}

// renderMetrics writes a Prometheus-compatible exposition for the current state.
// Dependency-free — no client_golang.
func renderMetrics(st State, ok bool, scanMs int64) string {
	var b strings.Builder
	g := func(name, help string, val float64) {
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s gauge\n%s %g\n", name, help, name, name, val)
	}
	bool01 := func(v bool) float64 {
		if v {
			return 1
		}
		return 0
	}

	g("megascope_up", "1 if the last scan succeeded.", bool01(ok))
	g("megascope_last_scan_timestamp_seconds", "Unix time of the last successful scan.", float64(st.UpdatedAt)/1000)
	g("megascope_scan_duration_seconds", "Duration of the last scan.", float64(scanMs)/1000)

	counts := map[string]int{"up": 0, "warn": 0, "down": 0, "unknown": 0}
	for _, r := range st.Routes {
		counts[r.Status]++
	}
	b.WriteString("# HELP megascope_routes Number of discovered routes by status.\n# TYPE megascope_routes gauge\n")
	for _, s := range []string{"up", "warn", "down", "unknown"} {
		fmt.Fprintf(&b, "megascope_routes{status=%q} %d\n", s, counts[s])
	}

	g("megascope_cluster_nodes", "Total cluster nodes.", float64(st.Cluster.Nodes))
	g("megascope_cluster_nodes_ready", "Ready cluster nodes.", float64(st.Cluster.NodesReady))
	g("megascope_cluster_pods", "Running/pending pods.", float64(st.Cluster.Pods))
	g("megascope_cluster_namespaces", "Namespaces.", float64(st.Cluster.Namespaces))
	if st.Cluster.CPU != nil {
		g("megascope_cluster_cpu_percent", "CPU commitment (requests/allocatable).", float64(*st.Cluster.CPU))
	}
	if st.Cluster.Memory != nil {
		g("megascope_cluster_memory_percent", "Memory commitment (requests/allocatable).", float64(*st.Cluster.Memory))
	}

	b.WriteString("# HELP megascope_route_up 1 if the route is reachable (up or warn), else 0.\n# TYPE megascope_route_up gauge\n")
	for _, r := range st.Routes {
		if r.Status == "unknown" {
			continue
		}
		v := bool01(r.Status == "up" || r.Status == "warn")
		fmt.Fprintf(&b, "megascope_route_up{namespace=%q,name=%q} %g\n", metricLabel(r.Namespace), metricLabel(r.Name), v)
	}
	b.WriteString("# HELP megascope_route_latency_milliseconds Last probe latency per route.\n# TYPE megascope_route_latency_milliseconds gauge\n")
	for _, r := range st.Routes {
		if r.Latency == nil {
			continue
		}
		fmt.Fprintf(&b, "megascope_route_latency_milliseconds{namespace=%q,name=%q} %d\n", metricLabel(r.Namespace), metricLabel(r.Name), *r.Latency)
	}
	return b.String()
}

func writeLinks(w http.ResponseWriter, ls *linkStore, code int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string][]Link{"links": ls.list()})
}

func registerLinkRoutes(mux *http.ServeMux, ls *linkStore) {
	mux.HandleFunc("GET /api/links", func(w http.ResponseWriter, _ *http.Request) {
		writeLinks(w, ls, http.StatusOK)
	})
	mux.HandleFunc("POST /api/links", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		var in Link
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		l, err := normalizeLink(in)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		l.ID = randID()
		if err := ls.add(l); err != nil {
			if errors.Is(err, errTooManyLinks) {
				http.Error(w, err.Error(), http.StatusBadRequest)
			} else {
				http.Error(w, "save failed", http.StatusInternalServerError)
			}
			return
		}
		writeLinks(w, ls, http.StatusCreated)
	})
	mux.HandleFunc("PUT /api/links/{id}", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		var in Link
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		l, err := normalizeLink(in)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		l.ID = r.PathValue("id")
		ok, err := ls.update(l)
		if err != nil {
			http.Error(w, "save failed", http.StatusInternalServerError)
			return
		}
		if !ok {
			http.NotFound(w, r)
			return
		}
		writeLinks(w, ls, http.StatusOK)
	})
	mux.HandleFunc("DELETE /api/links/{id}", func(w http.ResponseWriter, r *http.Request) {
		ok, err := ls.remove(r.PathValue("id"))
		if err != nil {
			http.Error(w, "save failed", http.StatusInternalServerError)
			return
		}
		if !ok {
			http.NotFound(w, r)
			return
		}
		writeLinks(w, ls, http.StatusOK)
	})
}

func main() {
	addr := envOr("ADDR", ":8080")
	webDir := envOr("WEB_DIR", "./web")
	clusterName := envOr("CLUSTER_NAME", "production")
	probing := envOr("PROBE_HEALTH", "true") != "false"
	interval := 30 * time.Second
	if v := os.Getenv("POLL_SECONDS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			interval = time.Duration(n) * time.Second
		}
	}

	s := &store{}
	links := newLinkStore(envOr("LINKS_FILE", ""))
	k, err := newK8s()
	if err != nil {
		log.Printf("warning: no in-cluster config (%v) — discovery disabled", err)
	} else {
		go func() {
			prevStatus := map[string]string{}
			histories := map[string][]int{}
			activity := []Activity{}
			first := true
			for {
				start := time.Now()
				routes, err := k.routes()
				if err != nil {
					log.Printf("discover: %v", err)
					time.Sleep(interval)
					continue
				}
				var latencies []int
				if probing {
					latencies = probeAll(routes)
					recordHistory(histories, routes)
				}
				cluster := k.cluster(clusterName, latencies)

				events, cur := diff(prevStatus, routes, first)
				prevStatus = cur
				first = false
				// newest first, capped
				activity = append(events, activity...)
				if len(activity) > activityMax {
					activity = activity[:activityMax]
				}

				s.set(State{
					Cluster:     cluster,
					Routes:      routes,
					Activity:    activity,
					UpdatedAt:   time.Now().UnixMilli(),
					Discovering: true,
				}, time.Since(start).Milliseconds())
				log.Printf("scan: %d routes, %d nodes, %d pods", len(routes), cluster.Nodes, cluster.Pods)
				time.Sleep(interval)
			}
		}()
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("ok\n"))
	})

	mux.HandleFunc("/api/routes", func(w http.ResponseWriter, _ *http.Request) {
		st, _, ok := s.snapshot()
		if st.Routes == nil {
			st.Routes = []Route{}
		}
		if st.Activity == nil {
			st.Activity = []Activity{}
		}
		if st.Cluster.Name == "" {
			st.Cluster.Name = clusterName
		}
		st.Discovering = ok
		st.Links = links.list()
		if st.Links == nil {
			st.Links = []Link{}
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(st)
	})

	mux.HandleFunc("/metrics", func(w http.ResponseWriter, _ *http.Request) {
		st, scanMs, ok := s.snapshot()
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Write([]byte(renderMetrics(st, ok, scanMs)))
	})

	registerLinkRoutes(mux, links)

	// Serve the built SPA, with a fallback to index.html for client routing.
	fileServer := http.FileServer(http.Dir(webDir))
	index := filepath.Join(webDir, "index.html")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(webDir, filepath.Clean(r.URL.Path))
		if r.URL.Path != "/" {
			if info, err := os.Stat(path); err == nil && !info.IsDir() {
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		http.ServeFile(w, r, index)
	})

	log.Printf("megascope listening on %s (web: %s, probing: %v)", addr, webDir, probing)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
