/**
 * Parent signup for the printable pinyin-and-translation PDF.
 * The Worker stores the address; Vite uses the same checks with a memory store.
 * The PDF itself stays in the git tree and is never attached to the mail.
 */

const REPO_RAW = "https://raw.githubusercontent.com/xiaowen-pm/Ancient-Chinese-Poems-for-Primary-School/main/assets";

const PDF_PARTS = ["01-图文版", "PDF版-带注音+译文", "02必背古诗词75首-PDF版.pdf"];

/** Same prefix as `sheetUrl` in data.ts. Kept here so the Worker does not import poems.json. */
const SHEET_BASE = `${REPO_RAW}/${encodeURIComponent("01-图文版")}/${encodeURIComponent("图片版-带注音+译文")}/`;

export const FULL_PDF_URL = `${REPO_RAW}/${PDF_PARTS.map((part) => encodeURIComponent(part)).join("/")}`;

const IP_LIMIT = 8;
const MAIL_LIMIT = 3;
const WINDOW_SECONDS = 60 * 60;
const MAX_BODY = 4096;

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

export function pdfLinks(sheet: string | null): PdfLink[] {
  const links: PdfLink[] = [{ title: "75 首必背古诗词 PDF（拼音和译文）", href: FULL_PDF_URL }];
  if (sheet) links.push({ title: "当前这一首的单页图文稿", href: SHEET_BASE + encodeURIComponent(sheet) });
  return links;
}

export function mailIsConfigured(apiKey: string | undefined, from: string | undefined): boolean {
  const key = apiKey?.trim() ?? "";
  const sender = from?.trim() ?? "";
  if (!key || !sender) return false;
  // The placeholder in wrangler.jsonc must not send.
  if (/@example\.com>?$/.test(sender)) return false;
  return true;
}

type SignupInput = {
  email: unknown;
  company: unknown;
  poemId: unknown;
  sheet: unknown;
  ip: string;
  origin: string | null;
  host: string;
};

type SignupDeps = {
  store: SignupStore | null;
  resendApiKey?: string;
  resendFrom?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

const fallbackRates = memorySignupStore();

export async function submitPdfSignup(input: SignupInput, deps: SignupDeps): Promise<PdfSignupResult> {
  if (!originAllowed(input.origin, input.host)) {
    return result(403, false, false, false, "这个页面不能提交。", []);
  }
  if (typeof input.email !== "string" || !isParentEmail(input.email)) {
    return result(400, false, false, false, "请填写一个能用的邮箱，例如 name@example.com", []);
  }
  const email = input.email.trim().toLowerCase();
  const links = pdfLinks(printableSheetName(input.sheet));
  const rates = deps.store ?? fallbackRates;
  const allowed = await bump(rates, `rate:${input.ip || "unknown"}`, IP_LIMIT, WINDOW_SECONDS);
  if (!allowed) {
    return result(429, false, false, false, "领取太频繁，请过一会儿再试。", []);
  }
  const honeypot = typeof input.company === "string" ? input.company.trim() : "";
  if (honeypot) {
    return result(200, true, false, false, "请用下面的链接下载。", links);
  }

  const now = deps.now ?? (() => new Date());
  const source = signupSource(input.poemId);
  let stored = false;
  if (deps.store) {
    stored = await remember(deps.store, email, source, now().toISOString());
  }

  if (!mailIsConfigured(deps.resendApiKey, deps.resendFrom)) {
    return result(200, true, stored, false, quietMessage(stored), links);
  }

  const canMail = await bump(rates, `mail:${email}`, MAIL_LIMIT, WINDOW_SECONDS);
  if (!canMail) {
    return result(200, true, stored, false, "刚才已经寄过。请查收邮箱，或直接打开下面的链接。", links);
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const emailed = await sendResend(fetchImpl, deps.resendApiKey!.trim(), deps.resendFrom!.trim(), email, links);
  if (!emailed) {
    return result(200, true, stored, false, "邮件暂时没发出，请先用下面的链接下载。", links);
  }
  return result(200, true, stored, true, "下载链接已经寄到邮箱，也可以直接打开。", links);
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
  if (!read.ok) return signupResponse(result(read.status, false, false, false, read.message, []));
  const url = new URL(request.url);
  const outcome = await submitPdfSignup(
    {
      email: read.body.email,
      company: read.body.company,
      poemId: read.body.poemId,
      sheet: read.body.sheet,
      ip: clientIp(request),
      origin: request.headers.get("origin"),
      host: request.headers.get("host") ?? url.host,
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
      links: payload.links,
    },
    {
      status: payload.status,
      headers: { "cache-control": "no-store" },
    },
  );
}

function result(status: number, ok: boolean, stored: boolean, emailed: boolean, message: string, links: PdfLink[]): PdfSignupResult {
  return { status, ok, stored, emailed, message, links };
}

function quietMessage(stored: boolean): string {
  return stored
    ? "邮件服务还没接通，名册已经记下。请先用下面的链接下载。"
    : "邮件服务还没接通。请先用下面的链接下载。";
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

async function sendResend(fetchImpl: typeof fetch, apiKey: string, from: string, email: string, links: PdfLink[]): Promise<boolean> {
  const text = [
    "你好，这是必背诗笺的可打印稿，带拼音和译文。",
    "",
    ...links.flatMap((link) => [link.title, link.href, ""]),
    "邮箱只用来寄这一份打印稿，不会转给别人，也不会用来推销。",
  ].join("\n");
  const html = [
    "<p>你好，这是必背诗笺的可打印稿，带拼音和译文。</p>",
    "<ul>",
    ...links.map((link) => `<li><a href="${escapeAttr(link.href)}">${escapeText(link.title)}</a></li>`),
    "</ul>",
    "<p>邮箱只用来寄这一份打印稿，不会转给别人，也不会用来推销。</p>",
  ].join("");
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "必背诗笺：可打印的古诗词 PDF",
        text,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
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
