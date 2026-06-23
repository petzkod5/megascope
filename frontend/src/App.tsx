import { useEffect, useMemo, useState } from 'react'

interface Route {
  name: string
  namespace: string
  hostnames: string[]
  url: string
  group?: string
  icon?: string
}

interface RoutesResponse {
  routes: Route[]
  updated_at: number
  discovering: boolean
}

const POLL_MS = 15_000

export function App() {
  const [data, setData] = useState<RoutesResponse | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    const tick = async () => {
      try {
        const res = await fetch('/api/routes', { signal: ctrl.signal })
        if (!res.ok) throw new Error(String(res.status))
        setData((await res.json()) as RoutesResponse)
        setError(false)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(true)
      }
    }
    tick()
    const t = window.setInterval(tick, POLL_MS)
    return () => {
      ctrl.abort()
      window.clearInterval(t)
    }
  }, [])

  const groups = useMemo(() => {
    const routes = (data?.routes ?? []).filter((r) => {
      if (!query) return true
      const q = query.toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        r.namespace.toLowerCase().includes(q) ||
        r.hostnames.some((h) => h.toLowerCase().includes(q))
      )
    })
    const map = new Map<string, Route[]>()
    for (const r of routes) {
      const g = r.group || 'Apps'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(r)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [data, query])

  const total = data?.routes.length ?? 0

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">◎</span>
          <div>
            <h1>megascope</h1>
            <p className="sub">rivendell · {total} {total === 1 ? 'app' : 'apps'} discovered</p>
          </div>
        </div>
        <input
          className="search"
          placeholder="filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="filter apps"
        />
      </header>

      {error && !data && (
        <p className="muted">couldn’t reach the megascope API.</p>
      )}
      {data && total === 0 && (
        <p className="muted">
          no HTTPRoutes discovered yet. {data.discovering ? '' : '(discovery is disabled — running outside the cluster?)'}
        </p>
      )}

      {groups.map(([group, routes]) => (
        <section key={group} className="group">
          <h2 className="groupTitle">{group}</h2>
          <div className="grid">
            {routes.map((r) => (
              <a
                key={`${r.namespace}/${r.name}`}
                className={`tile ${r.url ? '' : 'tileDead'}`}
                href={r.url || undefined}
                target="_blank"
                rel="noreferrer"
              >
                <span className="icon" aria-hidden="true">{r.icon || r.name.charAt(0).toUpperCase()}</span>
                <span className="meta">
                  <span className="name">{r.name}</span>
                  <span className="host">{r.hostnames[0] ?? r.namespace}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
