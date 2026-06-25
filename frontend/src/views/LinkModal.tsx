import { useState, type CSSProperties } from "react";
import { Modal } from "../components/Modal";
import { SearchInput } from "../components/SearchInput";
import { Button } from "../components/Button";
import { Ico } from "../components/Ico";
import { IconPicker } from "../components/IconPicker";
import type { CustomLink } from "../types";
import type { LinkInput } from "../api";

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontFamily: "var(--font-display)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
};

export function LinkModal({
  mode,
  initial,
  onClose,
  onSubmit,
  onDelete,
}: {
  mode: "create" | "edit";
  initial?: CustomLink;
  onClose: () => void;
  onSubmit: (b: LinkInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [group, setGroup] = useState(initial?.group ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name, url, icon, group });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={mode === "create" ? "Add link" : "Edit link"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="link-name">Name</label>
          <SearchInput id="link-name" value={name} placeholder="Grafana" onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="link-url">URL</label>
          <SearchInput id="link-url" value={url} placeholder="grafana.example.com or https://…" onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="link-group">Group</label>
          <SearchInput id="link-group" value={group} placeholder="Links (optional)" onChange={(e) => setGroup(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Icon</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        {error && <div style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          <div>
            {mode === "edit" && onDelete ? (
              confirmDelete ? (
                <Button variant="danger" disabled={busy} onClick={remove}>
                  Confirm remove
                </Button>
              ) : (
                <Button variant="ghost" icon={<Ico name="trash-2" size={14} />} onClick={() => setConfirmDelete(true)}>
                  Remove
                </Button>
              )
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy || !name.trim() || !url.trim()} onClick={submit}>
              {mode === "create" ? "Add" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
