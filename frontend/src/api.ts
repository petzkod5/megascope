import type { CustomLink } from "./types";

export interface LinkInput {
  name: string;
  url: string;
  icon?: string;
  group?: string;
}

/* Narrow the JSON envelope ({ "links": [...] }) the backend returns for every
   link mutation, without an unchecked cast. */
function parseLinks(v: unknown): CustomLink[] {
  if (v && typeof v === "object" && "links" in v && Array.isArray(v.links)) {
    return v.links;
  }
  return [];
}

async function mutate(method: string, url: string, body?: LinkInput): Promise<CustomLink[]> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.text()) || String(res.status));
  return parseLinks(await res.json());
}

export const createLink = (b: LinkInput) => mutate("POST", "/api/links", b);
export const updateLink = (id: string, b: LinkInput) => mutate("PUT", `/api/links/${encodeURIComponent(id)}`, b);
export const deleteLink = (id: string) => mutate("DELETE", `/api/links/${encodeURIComponent(id)}`);
