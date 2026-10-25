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

/** Print sheets stay in the git tree and are not bundled into `dist/`. */
const SHEET_BASE =
  "https://raw.githubusercontent.com/xiaowen-pm/Ancient-Chinese-Poems-for-Primary-School/main/assets/01-%E5%9B%BE%E6%96%87%E7%89%88/%E5%9B%BE%E7%89%87%E7%89%88-%E5%B8%A6%E6%B3%A8%E9%9F%B3%2B%E8%AF%91%E6%96%87/";

export function sheetUrl(file: string): string {
  return SHEET_BASE + encodeURIComponent(file);
}

export function findPoem(id: string): Poem | undefined {
  return poems.find((poem) => poem.id === id);
}

export function findSoon(id: string): SoonPoem | undefined {
  return soonPoems.find((poem) => poem.id === id);
}
