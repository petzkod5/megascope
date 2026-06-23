// megascope — a homepage/portal for the Rivendell cluster. Auto-discovers
// Gateway API HTTPRoutes via the in-cluster Kubernetes API and serves them as a
// single dashboard. Dependency-free: talks to the API directly with the mounted
// ServiceAccount token (no client-go), so it's a tiny static binary.
//
// Apps can customise their tile with annotations on the HTTPRoute:
//   megascope.petzko.sh/name   display name (default: route name)
//   megascope.petzko.sh/group  group/category heading
//   megascope.petzko.sh/icon   emoji or short label shown on the tile
//   megascope.petzko.sh/url    override link (default: http://<first hostname>)
//   megascope.petzko.sh/hidden "true" to exclude from the portal
package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	tokenPath      = "/var/run/secrets/kubernetes.io/serviceaccount/token"
	caPath         = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
	apiHost        = "https://kubernetes.default.svc"
	httpRoutesPath = "/apis/gateway.networking.k8s.io/v1/httproutes"
	annPrefix      = "megascope.petzko.sh/"
)

// Route is one discovered app, as served to the frontend.
type Route struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Hostnames []string `json:"hostnames"`
	URL       string   `json:"url"`
	Group     string   `json:"group,omitempty"`
	Icon      string   `json:"icon,omitempty"`
}

// Minimal shape of the HTTPRoute list returned by the Kubernetes API.
type httpRouteList struct {
	Items []struct {
		Metadata struct {
			Name        string            `json:"name"`
			Namespace   string            `json:"namespace"`
			Annotations map[string]string `json:"annotations"`
		} `json:"metadata"`
		Spec struct {
			Hostnames []string `json:"hostnames"`
		} `json:"spec"`
	} `json:"items"`
}

type store struct {
	mu      sync.RWMutex
	routes  []Route
	updated time.Time
	ok      bool
}

func (s *store) set(r []Route) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.routes, s.updated, s.ok = r, time.Now(), true
}

func (s *store) snapshot() ([]Route, time.Time, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.routes, s.updated, s.ok
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// k8sClient builds a client for the Kubernetes API and returns it with the
// bearer token and base URL. In-cluster it trusts the mounted CA and uses the SA
// token. For local testing, set KUBE_API (e.g. http://localhost:8001 from
// `kubectl proxy`) — no TLS/token needed.
func k8sClient() (*http.Client, string, string, error) {
	if base := os.Getenv("KUBE_API"); base != "" {
		return &http.Client{Timeout: 10 * time.Second}, "", strings.TrimRight(base, "/"), nil
	}
	ca, err := os.ReadFile(caPath)
	if err != nil {
		return nil, "", "", fmt.Errorf("read ca: %w", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		return nil, "", "", fmt.Errorf("parse ca")
	}
	token, err := os.ReadFile(tokenPath)
	if err != nil {
		return nil, "", "", fmt.Errorf("read token: %w", err)
	}
	client := &http.Client{
		Timeout:   10 * time.Second,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}},
	}
	return client, strings.TrimSpace(string(token)), apiHost, nil
}

func discover(client *http.Client, token, baseURL string) ([]Route, error) {
	req, _ := http.NewRequest(http.MethodGet, baseURL+httpRoutesPath, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("kubernetes api: %s", resp.Status)
	}
	var list httpRouteList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
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
		url := ann[annPrefix+"url"]
		if url == "" && len(it.Spec.Hostnames) > 0 {
			url = "http://" + it.Spec.Hostnames[0]
		}
		routes = append(routes, Route{
			Name:      name,
			Namespace: it.Metadata.Namespace,
			Hostnames: it.Spec.Hostnames,
			URL:       url,
			Group:     ann[annPrefix+"group"],
			Icon:      ann[annPrefix+"icon"],
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

func main() {
	addr := envOr("ADDR", ":8080")
	webDir := envOr("WEB_DIR", "./web")
	interval := 30 * time.Second

	s := &store{}
	client, token, baseURL, err := k8sClient()
	if err != nil {
		log.Printf("warning: no in-cluster config (%v) — discovery disabled", err)
	} else {
		go func() {
			for {
				if routes, err := discover(client, token, baseURL); err != nil {
					log.Printf("discover: %v", err)
				} else {
					s.set(routes)
					log.Printf("discovered %d routes", len(routes))
				}
				time.Sleep(interval)
			}
		}()
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("ok\n"))
	})

	mux.HandleFunc("/api/routes", func(w http.ResponseWriter, _ *http.Request) {
		routes, updated, ok := s.snapshot()
		if routes == nil {
			routes = []Route{}
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(map[string]any{
			"routes":     routes,
			"updated_at": updated.UnixMilli(),
			"discovering": ok,
		})
	})

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

	log.Printf("megascope listening on %s (web: %s)", addr, webDir)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
