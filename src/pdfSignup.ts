/**
 * Parent signup for the printable pinyin-and-translation PDF.
 * The Worker stores the address and mails a download link through Resend;
 * Vite uses the same checks with a memory store. The PDF stays in the git
 * tree and is served on the site's own origin, so the link works even where
 * raw.githubusercontent.com is slow or blocked.
 */

import {
  mailStatus,
  pickApiKey,
  pickSender,
  resolveSender,
  sendViaResend,
  type DomainRow,
  type MailMessage,
  type SenderSource,
} from "./resend.ts";

const REPO_RAW = "https://raw.githubusercontent.com/xiaowen-pm/Ancient-Chinese-Poems-for-Primary-School/main/assets";

const PDF_PARTS = ["01-图文版", "PDF版-带注音+译文", "02必背古诗词75首-PDF版.pdf"];

/** Same prefix as `sheetUrl` in data.ts. Kept here so the Worker does not import poems.json. */
export const SHEET_BASE = `${REPO_RAW}/${encodeURIComponent("01-图文版")}/${encodeURIComponent("图片版-带注音+译文")}/`;

export const FULL_PDF_URL = `${REPO_RAW}/${PDF_PARTS.map((part) => encodeURIComponent(part)).join("/")}`;

/** Paths the site answers itself, so one link works on every deployment. */
export const FULL_PDF_PATH = "/api/pdf/full.pdf";
export const PAGE_IMAGE_PATH = "/api/pdf/page.jpg";

const FULL_PDF_NAME = "必背古诗词75首-带拼音和译文.pdf";
const FULL_PDF_ASCII = "bibei-poems-75.pdf";
const PAGE_IMAGE_ASCII = "bibei-poem-page.jpg";

const IP_LIMIT = 8;
const MAIL_LIMIT = 3;
const WINDOW_SECONDS = 60 * 60;
const MAX_BODY = 4096;
const DEFAULT_BASE = "https://bibei.example";

export type PdfLink = { title: string; href: string };

export type SignupRecord = {
  email: string;
  createdAt: string;
  updatedAt: string;
  source: string;
};

export type SignupStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export type PdfSignupResult = {
  status: number;
  ok: boolean;
  stored: boolean;
  emailed: boolean;
  message: string;
  /** Technical reason from Resend or the mail setup, shown in small print. */
  detail: string;
  links: PdfLink[];
};

export function memorySignupStore(now: () => number = Date.now): SignupStore {
  const rows = new Map<string, { value: string; expiresAt: number | null }>();
  return {
    async get(key) {
      const row = rows.get(key);
      if (!row) return null;
      if (row.expiresAt !== null && row.expiresAt <= now()) {
        rows.delete(key);
        return null;
      }
      return row.value;
    },
    async put(key, value, options) {
      const ttl = options?.expirationTtl;
      rows.set(key, {
        value,
        expiresAt: ttl && ttl > 0 ? now() + ttl * 1000 : null,
      });
    },
  };
}

export function isParentEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || domain.length > 253) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  if (!/^[a-z0-9.-]+$/.test(domain)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1] ?? "";
  if (!/^[a-z]{2,}$/.test(tld)) return false;
  return labels.every((label) => label.length > 0 && label.length <= 63 && !label.startsWith("-") && !label.endsWith("-"));
}

export function printableSheetName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length < 5 || name.length > 120) return null;
  if (!name.endsWith(".jpg")) return null;
  if (name.includes("/") || name.includes("\\") || name.includes("..") || name.includes("\0")) return null;
  return name;
}

/** The poem name is only used in the subject line; strip anything header-like. */
export function poemTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 24);
}

export function pdfLinks(sheet: string | null, base: string = DEFAULT_BASE): PdfLink[] {
  const root = base.replace(/\/+$/, "");
  const links: PdfLink[] = [{ title: "整本 75 首 · PDF（带拼音和译文）", href: `${root}${FULL_PDF_PATH}` }];
  if (sheet) {
    links.push({
      title: "这一首的单页 · A4 图文稿",
      href: `${root}${PAGE_IMAGE_PATH}?name=${encodeURIComponent(sheet)}`,
    });
  }
  return links;
}

type SignupInput = {
  email: unknown;
  company: unknown;
  poemId: unknown;
  sheet: unknown;
  title?: unknown;
  ip: string;
  origin: string | null;
  host: string;
  base?: string;
};

type SignupDeps = {
  store: SignupStore | null;
  resendApiKey?: string | null;
  resendFrom?: string | null;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

const fallbackRates = memorySignupStore();

export async function submitPdfSignup(input: SignupInput, deps: SignupDeps): Promise<PdfSignupResult> {
  if (!originAllowed(input.origin, input.host)) {
    return result(403, false, false, false, "这个页面不能提交。", "", []);
  }
  if (typeof input.email !== "string" || !isParentEmail(input.email)) {
    return result(400, false, false, false, "请填写一个能用的邮箱，例如 name@example.com", "", []);
  }
  const email = input.email.trim().toLowerCase();
  const links = pdfLinks(printableSheetName(input.sheet), input.base ?? DEFAULT_BASE);
  const rates = deps.store ?? fallbackRates;
  const allowed = await bump(rates, `rate:${input.ip || "unknown"}`, IP_LIMIT, WINDOW_SECONDS);
  if (!allowed) {
    return result(429, false, false, false, "领取太频繁，请过一会儿再试。", "", []);
  }
  const honeypot = typeof input.company === "string" ? input.company.trim() : "";
  if (honeypot) {
    return result(200, true, false, false, "请用下面的按钮下载。", "", links);
  }

  const now = deps.now ?? (() => new Date());
  const source = signupSource(input.poemId);
  let stored = false;
  if (deps.store) {
    stored = await remember(deps.store, email, source, now().toISOString());
  }

  const apiKey = deps.resendApiKey?.trim() || null;
  const sender = await resolveSender({ apiKey, from: deps.resendFrom ?? null, fetchImpl: deps.fetchImpl });
  if (!apiKey || !sender.from) {
    return result(200, true, stored, false, quietMessage(stored), sender.detail, links);
  }

  const canMail = await bump(rates, `mail:${email}`, MAIL_LIMIT, WINDOW_SECONDS);
  if (!canMail) {
    return result(200, true, stored, false, "刚才已经寄过。请查收邮箱，也可以直接点下面的按钮。", "", links);
  }

  const message = composeMail(sender.from, email, poemTitle(input.title), links);
  const sent = await sendViaResend(apiKey, message, deps.fetchImpl ?? fetch);
  if (!sent.ok) {
    console.error("resend send failed", sent.status, sent.detail, { sender: sender.from, source: sender.source });
    const reason = sent.status ? `Resend ${sent.status}：${sent.detail}` : sent.detail;
    return result(200, true, stored, false, "邮件暂时没发出，请先用下面的按钮下载。", reason, links);
  }
  return result(200, true, stored, true, `PDF 已经寄到 ${email}，也可以直接点下面的按钮。`, "", links);
}

export async function readSignupBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: number; message: string }> {
  if (request.method !== "POST") {
    return { ok: false, status: 405, message: "请从页面上的表单领取。" };
  }
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, message: "请从页面上的表单领取。" };
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) {
    return { ok: false, status: 413, message: "内容太长。" };
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) return { ok: false, status: 413, message: "内容太长。" };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, status: 400, message: "请再填写一次。" };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, message: "请再填写一次。" };
  }
}

export async function handlePdfHttp(request: Request, deps: SignupDeps): Promise<Response> {
  const read = await readSignupBody(request);
  if (!read.ok) return signupResponse(result(read.status, false, false, false, read.message, "", []));
  const url = new URL(request.url);
  const outcome = await submitPdfSignup(
    {
      email: read.body.email,
      company: read.body.company,
      poemId: read.body.poemId,
      sheet: read.body.sheet,
      title: read.body.title,
      ip: clientIp(request),
      origin: request.headers.get("origin"),
      host: request.headers.get("host") ?? url.host,
      base: url.origin,
    },
    deps,
  );
  return signupResponse(outcome);
}

export function signupResponse(payload: PdfSignupResult): Response {
  return Response.json(
    {
      ok: payload.ok,
      stored: payload.stored,
      emailed: payload.emailed,
      message: payload.message,
      detail: payload.detail,
      links: payload.links,
    },
    {
      status: payload.status,
      headers: { "cache-control": "no-store" },
    },
  );
}

function result(
  status: number,
  ok: boolean,
  stored: boolean,
  emailed: boolean,
  message: string,
  detail: string,
  links: PdfLink[],
): PdfSignupResult {
  return { status, ok, stored, emailed, message, detail, links };
}

function quietMessage(stored: boolean): string {
  return stored
    ? "邮件服务还没接通，名册已经记下。请先用下面的按钮下载。"
    : "邮件服务还没接通。请先用下面的按钮下载。";
}

function composeMail(from: string, to: string, title: string, links: PdfLink[]): MailMessage {
  const subject = title ? `《${title}》可打印 PDF（带拼音和译文）` : "可打印的古诗词 PDF（75 首，带拼音和译文）";
  const text = [
    "你好，",
    "",
    "这是必背诗笺的打印稿，点开就能下载：",
    "",
    ...links.flatMap((link) => [link.title, link.href, ""]),
    "没收到这封信也没关系，页面上同样有下载按钮。",
    "",
    "必背诗笺 · 免费的小学生必背古诗词读本",
  ].join("\n");
  const buttons = links
    .map(
      (link, index) =>
        `<p style="margin:0 0 12px"><a href="${escapeAttr(link.href)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:${
          index === 0 ? "#b23a2b" : "#f3ece6"
        };color:${index === 0 ? "#ffffff" : "#8c2f22"};text-decoration:none">${escapeText(link.title)}</a></p>`,
    )
    .join("");
  const html = [
    "<div style=\"font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;font-size:16px;line-height:1.7;color:#2b2b2b\">",
    "<p>你好，</p>",
    "<p>这是必背诗笺的打印稿，点开就能下载：</p>",
    buttons,
    '<p style="color:#7a7a7a;font-size:13px">没收到这封信也没关系，页面上同样有下载按钮。</p>',
    '<p style="color:#7a7a7a;font-size:13px;margin-top:24px">必背诗笺 · 免费的小学生必背古诗词读本</p>',
    "</div>",
  ].join("");
  return { from, to, subject, text, html };
}

function escapeText(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    return "&quot;";
  });
}

function escapeAttr(value: string): string {
  return escapeText(value);
}

function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 64);
  return "local";
}

function originAllowed(origin: string | null, host: string): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function signupSource(poemId: unknown): string {
  if (typeof poemId === "string" && /^[a-z0-9-]{1,40}$/.test(poemId)) return `web:${poemId}`;
  return "web";
}

async function remember(store: SignupStore, email: string, source: string, timestamp: string): Promise<boolean> {
  const key = `signup:${email}`;
  const previous = await store.get(key);
  let createdAt = timestamp;
  if (previous) {
    try {
      const parsed = JSON.parse(previous) as Partial<SignupRecord>;
      if (typeof parsed.createdAt === "string" && parsed.createdAt) createdAt = parsed.createdAt;
    } catch {
      createdAt = timestamp;
    }
  }
  const record: SignupRecord = { email, createdAt, updatedAt: timestamp, source };
  await store.put(key, JSON.stringify(record));
  return true;
}

async function bump(store: SignupStore, key: string, limit: number, ttl: number): Promise<boolean> {
  const raw = await store.get(key);
  const count = raw === null ? 0 : Number(raw);
  if (!Number.isFinite(count) || count >= limit) return false;
  await store.put(key, String(count + 1), { expirationTtl: ttl });
  return true;
}

type PdfTarget = { url: string; filename: string; ascii: string; type: string; inline: boolean };

/** Map a same-origin download path to the file in the repository. */
export function pdfTarget(url: URL): { target: PdfTarget } | { status: number; message: string } | null {
  if (url.pathname === FULL_PDF_PATH) {
    return {
      target: { url: FULL_PDF_URL, filename: FULL_PDF_NAME, ascii: FULL_PDF_ASCII, type: "application/pdf", inline: false },
    };
  }
  if (url.pathname === PAGE_IMAGE_PATH) {
    const name = printableSheetName(url.searchParams.get("name"));
    if (!name) return { status: 400, message: "没有指定这一首的单页稿。" };
    return {
      target: {
        url: `${SHEET_BASE}${encodeURIComponent(name)}`,
        filename: name,
        ascii: PAGE_IMAGE_ASCII,
        type: "image/jpeg",
        inline: true,
      },
    };
  }
  return null;
}

async function servePdf(request: Request, url: URL, fetchImpl: typeof fetch): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return textResponse(405, "请直接下载。");
  }
  const mapped = pdfTarget(url);
  if (!mapped) return textResponse(404, "没有这个文件。");
  if ("status" in mapped) return textResponse(mapped.status, mapped.message);

  const { target } = mapped;
  try {
    const upstream = await fetchImpl(target.url, {
      headers: {
        "user-agent": "bibei-shijian/1.0 (+https://github.com/xiaowen-pm/Ancient-Chinese-Poems-for-Primary-School)",
      },
      // Workers cache the 13 MB book at the edge; other runtimes ignore this.
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit);
    if (!upstream.ok || !upstream.body) {
      return textResponse(502, "文件暂时取不到，请稍后再试。");
    }
    const headers = new Headers({
      "content-type": target.type,
      "content-disposition": `${target.inline ? "inline" : "attachment"}; filename="${target.ascii}"; filename*=UTF-8''${encodeURIComponent(
        target.filename,
      )}`,
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
    });
    const length = upstream.headers.get("content-length");
    if (length) headers.set("content-length", length);
    return new Response(request.method === "HEAD" ? null : upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("pdf fetch failed", target.url, error);
    return textResponse(502, "文件暂时取不到，请稍后再试。");
  }
}

function textResponse(status: number, message: string): Response {
  return new Response(`${message}\n`, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export type ApiContext = {
  /** Cloudflare vars and secrets, or the local `.dev.vars` values. */
  env?: Record<string, string | undefined>;
  store?: SignupStore | null;
  resendApiKey?: string | null;
  resendFrom?: string | null;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export type MailStatus = {
  ok: true;
  keyPresent: boolean;
  keyPreview: string;
  sender: string | null;
  senderSource: SenderSource;
  domains: DomainRow[];
  ready: boolean;
  detail: string;
  hint: string;
};

/** Every `/api/` route the site answers, or `null` when the path is not ours. */
export async function routeApi(request: Request, context: ApiContext = {}): Promise<Response | null> {
  const url = new URL(request.url);
  const env = context.env ?? {};
  const apiKey = context.resendApiKey ?? pickApiKey(env);
  const from = context.resendFrom ?? pickSender(env);

  if (url.pathname === "/api/pdf-request") {
    return handlePdfHttp(request, {
      store: context.store ?? null,
      resendApiKey: apiKey,
      resendFrom: from,
      fetchImpl: context.fetchImpl,
      now: context.now,
    });
  }
  if (url.pathname === "/api/mail-status") {
    const status = await mailStatus({ apiKey: apiKey ?? null, from: from ?? null, fetchImpl: context.fetchImpl });
    // `envKeys` lists binding names only, so a missing secret can be told apart
    // from a rejected key without ever printing the value.
    return Response.json(
      { ok: true, ...status, hint: senderHint(status), envKeys: Object.keys(env).sort() } satisfies MailStatus & { envKeys: string[] },
      {
        headers: { "cache-control": "no-store" },
      },
    );
  }
  if (url.pathname.startsWith("/api/pdf/")) {
    return servePdf(request, url, context.fetchImpl ?? fetch);
  }
  return null;
}

function senderHint(status: { keyPresent: boolean; sender: string | null; detail: string }): string {
  if (!status.keyPresent) return "在 Cloudflare 里加一个变量：名称 RESEND_API_KEY（或 resend），值是 Resend 的 API Key。";
  if (!status.sender) {
    return "在 Resend 里验证一个发信域名，或者设置变量 RESEND_FROM，例如：必背诗笺 <pdf@your-domain.com>。";
  }
  return "发信已经就绪。";
}
