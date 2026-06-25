import { lazy, Suspense, useMemo, type ComponentType } from "react";
import {
  Radar,
  Search,
  RefreshCw,
  Settings,
  PlugZap,
  LayoutGrid,
  List,
  ArrowLeft,
  Link,
  ExternalLink,
  Copy,
  Info,
  Plus,
  Pencil,
  Trash2,
  X,
  type LucideProps,
} from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";

/* Ico — renders a lucide icon by kebab-case name (e.g. "chart-spline"), or, if
   the value isn't a lucide name (e.g. an emoji "◎"), renders it literally. This
   matches the app.megascope.io/icon annotation, which accepts either.

   The fixed UI-chrome icons are statically imported (small, no load flash).
   Arbitrary annotation-driven icons are lazy-loaded per-icon via lucide's
   dynamicIconImports, so the main bundle doesn't carry all ~1500 icons. */

const STATIC: Record<string, ComponentType<LucideProps>> = {
  radar: Radar,
  search: Search,
  "refresh-cw": RefreshCw,
  settings: Settings,
  "plug-zap": PlugZap,
  "layout-grid": LayoutGrid,
  list: List,
  "arrow-left": ArrowLeft,
  link: Link,
  "external-link": ExternalLink,
  copy: Copy,
  info: Info,
  plus: Plus,
  pencil: Pencil,
  "trash-2": Trash2,
  x: X,
};

const loaders = dynamicIconImports as unknown as Record<
  string,
  () => Promise<{ default: ComponentType<LucideProps> }>
>;
const lazyCache = new Map<string, ComponentType<LucideProps>>();

function dynamicIcon(name: string): ComponentType<LucideProps> | null {
  if (!loaders[name]) return null;
  let C = lazyCache.get(name);
  if (!C) {
    C = lazy(loaders[name]) as unknown as ComponentType<LucideProps>;
    lazyCache.set(name, C);
  }
  return C;
}

export function Ico({ name, size = 16, stroke = 2 }: { name?: string; size?: number; stroke?: number }) {
  const isLucide = !!name && /^[a-z][a-z0-9-]*$/.test(name);
  const Cmp = useMemo(() => (isLucide ? STATIC[name!] ?? dynamicIcon(name!) : null), [isLucide, name]);

  if (!name) return null;
  if (!isLucide || !Cmp) {
    return <span style={{ fontSize: size, lineHeight: 1, display: "inline-flex" }}>{name}</span>;
  }
  const el = <Cmp size={size} strokeWidth={stroke} />;
  if (STATIC[name]) return el;
  return <Suspense fallback={<span style={{ display: "inline-flex", width: size, height: size }} />}>{el}</Suspense>;
}
