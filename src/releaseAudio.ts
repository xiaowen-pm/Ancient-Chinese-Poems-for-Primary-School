/**
 * Stream one stored MP3 out of a GitHub Release zip.
 *
 * The release assets are ten zip files, not loose MP3s. GitHub's download
 * URL redirects to a short-lived blob URL that accepts `bytes=start-end`
 * ranges (a suffix range such as `bytes=-N` is rejected). Browsers cannot
 * read those bytes: the blob response has no CORS header. This module runs
 * on the same origin (Vite in dev, the Worker in production), copies one
 * stored entry out of the zip, and answers with `audio/mpeg`.
 */

const RELEASE =
  "https://github.com/xiaowen-pm/Ancient-Chinese-Poems-for-Primary-School/releases/download/assets-audio/";

const ALLOWED_ZIPS = new Set(
  Array.from({ length: 10 }, (_, index) => `audio-${String(index + 1).padStart(2, "0")}.zip`),
);

type ZipEntry = {
  method: number;
  size: number;
  localOffset: number;
  dataStart?: number;
};

type Catalog = {
  url: string;
  expiresAt: number;
  entries: Map<string, ZipEntry>;
};

const catalogs = new Map<string, Catalog>();

export function parsePack(url: URL): { zip: string; file: string } | null {
  if (url.pathname !== "/audio-pack") return null;
  const zip = url.searchParams.get("zip") ?? "";
  const file = url.searchParams.get("file") ?? "";
  if (!ALLOWED_ZIPS.has(zip)) return null;
  if (!file.endsWith(".mp3") || file.includes("..") || file.startsWith("/") || file.length > 400) return null;
  return { zip, file };
}

function packUrl(zip: string, file: string): string {
  return `audio-pack?zip=${encodeURIComponent(zip)}&file=${encodeURIComponent(file)}`;
}

export { packUrl };

async function ranged(url: string, start: number, end: number): Promise<Response> {
  const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
  if (response.status !== 206) {
    throw new Error(`range ${response.status} for ${start}-${end}`);
  }
  return response;
}

async function loadCatalog(zip: string): Promise<Catalog> {
  const cached = catalogs.get(zip);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const probe = await ranged(`${RELEASE}${zip}`, 0, 0);
  const total = totalSize(probe.headers.get("content-range"));
  const tailStart = Math.max(0, total - 256 * 1024);
  const tailResponse = await ranged(probe.url, tailStart, total - 1);
  const tail = new Uint8Array(await tailResponse.arrayBuffer());
  const eocdAt = lastIndexOf(tail, [0x50, 0x4b, 0x05, 0x06]);
  if (eocdAt < 0) throw new Error(`zip 目录读不到：${zip}`);
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  const cdSize = view.getUint32(eocdAt + 12, true);
  const cdOffset = view.getUint32(eocdAt + 16, true);
  const cdResponse = await ranged(probe.url, cdOffset, cdOffset + cdSize - 1);
  const cd = new Uint8Array(await cdResponse.arrayBuffer());
  const entries = parseCentralDirectory(cd);
  const catalog: Catalog = { url: probe.url, expiresAt: Date.now() + 20 * 60 * 1000, entries };
  catalogs.set(zip, catalog);
  return catalog;
}

function totalSize(header: string | null): number {
  const match = header?.match(/\/(\d+)\s*$/);
  if (!match) throw new Error("缺少 Content-Range");
  return Number(match[1]);
}

function lastIndexOf(buf: Uint8Array, needle: number[]): number {
  outer: for (let i = buf.length - needle.length; i >= 0; i -= 1) {
    for (let j = 0; j < needle.length; j += 1) if (buf[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function parseCentralDirectory(cd: Uint8Array): Map<string, ZipEntry> {
  const entries = new Map<string, ZipEntry>();
  const view = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  let pos = 0;
  while (pos + 46 <= cd.length) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const size = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = new TextDecoder("utf-8").decode(cd.subarray(pos + 46, pos + 46 + nameLen));
    entries.set(name, { method, size, localOffset });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function dataStart(catalog: Catalog, entry: ZipEntry): Promise<number> {
  if (entry.dataStart != null) return entry.dataStart;
  const headerResponse = await ranged(catalog.url, entry.localOffset, entry.localOffset + 30 + 700);
  const header = new Uint8Array(await headerResponse.arrayBuffer());
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50) throw new Error("zip 本地文件头不对");
  const nameLen = view.getUint16(26, true);
  const extraLen = view.getUint16(28, true);
  entry.dataStart = entry.localOffset + 30 + nameLen + extraLen;
  return entry.dataStart;
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = header.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;
  if (match[1] === "" && match[2] !== "") {
    const length = Number(match[2]);
    const start = Math.max(0, size - length);
    return { start, end: size - 1 };
  }
  const start = Number(match[1] || 0);
  const end = match[2] === "" ? size - 1 : Math.min(size - 1, Number(match[2]));
  if (start > end || start >= size) return { start: size, end: size - 1 };
  return { start, end };
}

export async function audioPackResponse(url: URL, rangeHeader: string | null): Promise<Response> {
  const parsed = parsePack(url);
  if (!parsed) return text(400, "音频地址不对");
  try {
    let catalog = await loadCatalog(parsed.zip);
    let entry = catalog.entries.get(parsed.file);
    if (!entry) {
      catalogs.delete(parsed.zip);
      catalog = await loadCatalog(parsed.zip);
      entry = catalog.entries.get(parsed.file);
    }
    if (!entry) return text(404, "压缩包里没有这一首");
    if (entry.method !== 0) return text(415, "这一条录音不是直接存放的，暂时不能分段播放");
    const start0 = await dataStart(catalog, entry);
    const slice = parseRange(rangeHeader, entry.size);
    const start = slice ? slice.start : 0;
    const end = slice ? slice.end : entry.size - 1;
    if (start >= entry.size || end < start) return text(416, "超出录音长度");
    const upstream = await readSlice(catalog, start0 + start, start0 + end);
    const headers = new Headers({
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
      "Content-Length": String(end - start + 1),
    });
    if (slice) {
      headers.set("Content-Range", `bytes ${start}-${end}/${entry.size}`);
      return new Response(upstream, { status: 206, headers });
    }
    return new Response(upstream, { status: 200, headers });
  } catch (error) {
    catalogs.delete(parsed.zip);
    const message = error instanceof Error ? error.message : "音频读取失败";
    return text(502, message);
  }
}

async function readSlice(catalog: Catalog, start: number, end: number): Promise<ReadableStream<Uint8Array> | null> {
  const response = await ranged(catalog.url, start, end);
  return response.body;
}

function text(status: number, message: string): Response {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
