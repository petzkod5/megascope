import { Ico } from "./Ico";
import { SearchInput } from "./SearchInput";

/* Curated lucide icons offered as a quick grid. Power users can still type any
   lucide name (or an emoji) in the free-text field below — Ico renders both. */
const CURATED = [
  "link", "external-link", "globe", "book-open", "code", "git-branch", "server", "database",
  "cloud", "terminal", "gauge", "activity", "monitor", "eye", "shield", "lock",
  "mail", "rss", "bell", "calendar", "folder", "file-text", "image", "music",
  "play", "download", "command", "star", "zap", "layers", "box", "home",
];

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            flex: "none",
            background: "var(--bg-inset)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xs)",
            color: "var(--accent)",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {value ? <Ico name={value} size={18} /> : "?"}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>preview</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
        {CURATED.map((n) => {
          const selected = n === value;
          return (
            <button
              key={n}
              type="button"
              title={n}
              onClick={() => onChange(n)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                padding: 0,
                cursor: "pointer",
                borderRadius: "var(--radius-xs)",
                color: selected ? "var(--accent)" : "var(--text-secondary)",
                border: selected ? "1px solid var(--border-accent)" : "1px solid var(--border-default)",
                background: selected ? "var(--accent-bg)" : "var(--bg-inset)",
              }}
            >
              <Ico name={n} size={16} />
            </button>
          );
        })}
      </div>

      <SearchInput
        value={value}
        placeholder="or type any lucide name / emoji"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
