import type { Poem, SoonPoem } from "./types.ts";

export type Span = readonly [number, number];

export type ReadyHit = {
  poemId: string;
  score: number;
  order: number;
  lineIndex: number;
  titleSpan: Span | null;
  authorSpan: Span | null;
  dynastySpan: Span | null;
  lineSpan: Span | null;
};

export type SoonHit = {
  poemId: string;
  score: number;
  order: number;
  titleSpan: Span | null;
  authorSpan: Span | null;
  dynastySpan: Span | null;
  lineSpan: Span | null;
  alias: string | null;
};

export type SearchResult = {
  ready: ReadyHit[];
  soon: SoonHit[];
  soonMore: number;
  readyMore: number;
};

const HAN = /\p{Script=Han}/u;
const READY_CAP = 20;
const SOON_CAP = 12;

type Scored = { score: number; span: Span | null };

export function normalizeQuery(raw: string): string | null {
  const text = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!text) return null;
  const useful = [...text].some((ch) => HAN.test(ch) || /[a-z0-9]/i.test(ch));
  if (!useful) return null;
  return text.slice(0, 80);
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/u\u0308/gi, "v")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function latinOf(query: string): string {
  return fold(query).replace(/[^a-z]/g, "");
}

function sameVu(a: string, b: string): boolean {
  return a.replaceAll("v", "u") === b.replaceAll("v", "u");
}

function syllablesOf(pinyin: string): string[] {
  return pinyin
    .split(/\s+/)
    .map((part) => fold(part).replace(/[^a-z]/g, ""))
    .filter(Boolean);
}

function spokenIndexes(text: string): number[] {
  const indexes: number[] = [];
  [...text].forEach((ch, index) => {
    if (HAN.test(ch)) indexes.push(index);
  });
  return indexes;
}

function spanIndexOf(text: string, query: string): Span | null {
  const at = text.indexOf(query);
  if (at < 0) return null;
  const start = [...text.slice(0, at)].length;
  return [start, [...query].length];
}

function squeeze(text: string): { chars: string[]; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  [...text].forEach((ch, index) => {
    if (HAN.test(ch)) {
      chars.push(ch);
      map.push(index);
    }
  });
  return { chars, map };
}

function matchHan(text: string, query: string): Span | null {
  const direct = spanIndexOf(text, query);
  if (direct) return direct;
  // "xyz好" must miss. Only ignore punctuation when the query is Chinese.
  if ([...query].some((ch) => /[a-z0-9]/i.test(ch))) return null;
  const needle = squeeze(query);
  if (!needle.chars.length) return null;
  const hay = squeeze(text);
  const width = needle.chars.length;
  if (width > hay.chars.length) return null;
  outer: for (let i = 0; i <= hay.chars.length - width; i += 1) {
    for (let j = 0; j < width; j += 1) {
      if (hay.chars[i + j] !== needle.chars[j]) continue outer;
    }
    const start = hay.map[i]!;
    const end = hay.map[i + width - 1]!;
    return [start, end - start + 1];
  }
  return null;
}

function pyHit(full: string, initials: string, query: string): boolean {
  if (full === query || sameVu(full, query)) return true;
  if (query.length >= 2 && (initials === query || sameVu(initials, query))) return true;
  if (query.length >= 3) {
    const fullU = full.replaceAll("v", "u");
    const queryU = query.replaceAll("v", "u");
    if (full.startsWith(query) || fullU.startsWith(queryU)) return true;
  }
  return false;
}

function matchPinyin(text: string, pinyin: string, latin: string): Span | null {
  if (!latin) return null;
  const syllables = syllablesOf(pinyin);
  const indexes = spokenIndexes(text);
  const count = Math.min(syllables.length, indexes.length);
  for (let start = 0; start < count; start += 1) {
    let full = "";
    let initials = "";
    for (let end = start; end < count; end += 1) {
      const syllable = syllables[end]!;
      full += syllable;
      initials += syllable[0] ?? "";
      if (pyHit(full, initials, latin)) {
        const from = indexes[start]!;
        const to = indexes[end]!;
        return [from, to - from + 1];
      }
      const fullU = full.replaceAll("v", "u");
      const queryU = latin.replaceAll("v", "u");
      if (fullU.length > queryU.length && initials.length > latin.length) break;
    }
  }
  return null;
}

function scoreField(
  kind: "title" | "author" | "dynasty" | "line" | "alias",
  text: string,
  pinyin: string | undefined,
  query: string,
  latin: string,
): Scored | null {
  const hanPart = [...query].filter((ch) => HAN.test(ch)).join("");
  // A mixed query such as "xyz好" has to satisfy the Chinese and the pinyin.
  // Otherwise the letters are matched and the Chinese is thrown away.
  if (hanPart) {
    const span = matchHan(text, hanPart);
    if (!span) return null;
    if (latin && !pinyin) return null;
    if (latin && pinyin && !matchPinyin(text, pinyin, latin)) return null;
    const exact = squeeze(text).chars.join("") === hanPart;
    const table = {
      title: exact ? 100 : 82,
      author: exact ? 64 : 52,
      dynasty: exact ? 44 : 36,
      line: 34,
      alias: exact ? 76 : 66,
    } as const;
    return { score: table[kind], span: kind === "alias" ? null : span };
  }
  if (!pinyin || !latin) return null;
  const span = matchPinyin(text, pinyin, latin);
  if (!span) return null;
  const joined = syllablesOf(pinyin).join("");
  const exact = joined === latin || sameVu(joined, latin);
  const bonus = kind === "title" ? 8 : kind === "author" ? 4 : kind === "dynasty" ? 2 : 0;
  return { score: (exact ? 70 : 30) + bonus, span: kind === "alias" ? null : span };
}

function searchReady(poem: Poem, order: number, query: string, latin: string): ReadyHit | null {
  let best = 0;
  let titleSpan: Span | null = null;
  let authorSpan: Span | null = null;
  let dynastySpan: Span | null = null;
  let lineIndex = 0;
  let lineSpan: Span | null = null;
  let lineScore = 0;

  const title = scoreField("title", poem.title, poem.titlePinyin, query, latin);
  if (title) {
    best = title.score;
    titleSpan = title.span;
  }
  const author = scoreField("author", poem.author, poem.authorPinyin, query, latin);
  if (author) {
    best = Math.max(best, author.score);
    authorSpan = author.span;
  }
  const dynasty = scoreField("dynasty", poem.dynasty, poem.dynastyPinyin, query, latin);
  if (dynasty) {
    best = Math.max(best, dynasty.score);
    dynastySpan = dynasty.span;
  }
  poem.lines.forEach((line, index) => {
    const found = scoreField("line", line.text, line.pinyin, query, latin);
    if (!found) return;
    best = Math.max(best, found.score);
    if (!lineSpan || found.score > lineScore) {
      lineSpan = found.span;
      lineIndex = index;
      lineScore = found.score;
    }
  });
  if (best <= 0) return null;
  return {
    poemId: poem.id,
    score: best,
    order,
    lineIndex: lineSpan ? lineIndex : 0,
    titleSpan,
    authorSpan,
    dynastySpan,
    lineSpan,
  };
}

function searchSoon(poem: SoonPoem, order: number, query: string, latin: string): SoonHit | null {
  let best = 0;
  let titleSpan: Span | null = null;
  let authorSpan: Span | null = null;
  let dynastySpan: Span | null = null;
  let lineSpan: Span | null = null;
  let alias: string | null = null;

  const title = scoreField("title", poem.title, poem.titlePinyin, query, latin);
  if (title) {
    best = title.score;
    titleSpan = title.span;
  }
  const author = scoreField("author", poem.author, poem.authorPinyin, query, latin);
  if (author) {
    best = Math.max(best, author.score);
    authorSpan = author.span;
  }
  const dynasty = scoreField("dynasty", poem.dynasty, poem.dynastyPinyin, query, latin);
  if (dynasty) {
    best = Math.max(best, dynasty.score);
    dynastySpan = dynasty.span;
  }
  for (const name of poem.aliases ?? []) {
    const found = scoreField("alias", name, undefined, query, latin);
    if (!found) continue;
    best = Math.max(best, found.score);
    alias = name;
  }
  if (poem.firstLine) {
    const found = scoreField("line", poem.firstLine, undefined, query, latin);
    if (found) {
      best = Math.max(best, found.score);
      lineSpan = found.span;
    }
  }
  if (best <= 0) return null;
  return { poemId: poem.id, score: best, order, titleSpan, authorSpan, dynastySpan, lineSpan, alias };
}

export function search(raw: string, readyPoems: Poem[], coming: SoonPoem[]): SearchResult {
  const query = normalizeQuery(raw);
  if (!query) return { ready: [], soon: [], soonMore: 0, readyMore: 0 };
  const latin = latinOf(query);
  const ready = readyPoems
    .map((poem, order) => searchReady(poem, order, query, latin))
    .filter((hit): hit is ReadyHit => hit !== null)
    .sort((a, b) => b.score - a.score || a.order - b.order);
  const soon = coming
    .map((poem, order) => searchSoon(poem, order, query, latin))
    .filter((hit): hit is SoonHit => hit !== null)
    .sort((a, b) => b.score - a.score || a.order - b.order);
  return {
    ready: ready.slice(0, READY_CAP),
    soon: soon.slice(0, SOON_CAP),
    readyMore: Math.max(0, ready.length - READY_CAP),
    soonMore: Math.max(0, soon.length - SOON_CAP),
  };
}
