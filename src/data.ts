import poemRaw from "./data/poems.json" with { type: "json" };
import soonRaw from "./data/soon.json" with { type: "json" };
import type { Poem, SoonPoem } from "./types.ts";

export const poems = poemRaw as Poem[];
export const soonPoems = soonRaw as SoonPoem[];

export function asset(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const clean = path.replace(/^\//, "");
  return base.endsWith("/") ? `${base}${clean}` : `${base}/${clean}`;
}

export function findPoem(id: string): Poem | undefined {
  return poems.find((poem) => poem.id === id);
}

export function findSoon(id: string): SoonPoem | undefined {
  return soonPoems.find((poem) => poem.id === id);
}
