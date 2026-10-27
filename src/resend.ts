/**
 * Resend wiring for the printable-PDF mail.
 *
 * Cloudflare variable names are easy to get slightly wrong: the dashboard may
 * hold the key as `resend`, while an older Worker read `RESEND_API_KEY`.
 * Accept both spellings. When no sender is configured, ask Resend which
 * domains are verified and use the first one, so the only thing that must be
 * set is the API key itself.
 */

export const RESEND_API = "https://api.resend.com";

const KEY_TTL = 10 * 60 * 1000;
const KEY_NAMES = ["RESEND_API_KEY", "resend", "RESEND_KEY", "resend_api_key", "RESEND_API"];
const FROM_NAMES = ["RESEND_FROM", "resend_from", "MAIL_FROM", "PDF_FROM"];

export type DomainRow = { name: string; status: string };

export type SenderSource = "env" | "domain" | "none";

export type SenderInfo = {
  from: string | null;
  source: SenderSource;
  /** Human-readable reason, shown on the page while the mail is being set up. */
  detail: string;
  domains: DomainRow[];
};

export type ResolveDeps = {
  apiKey: string | null;
  from: string | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Skip the module-level cache, used by the status endpoint. */
  fresh?: boolean;
};

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; status: number; detail: string };

type Cached = { at: number; info: SenderInfo };

const cache = new Map<string, Cached>();

/** Anything that is not a real address must never be used as a sender. */
export function usableSender(value: string | null | undefined): string | null {
  const from = value?.trim() ?? "";
  if (!from) return null;
  const address = (from.match(/<([^<>]+)>/)?.[1] ?? from).trim();
  if (!/^[^@<>\s]+@[^@<>\s]+\.[a-z]{2,}$/i.test(address)) return null;
  // A leftover placeholder from the template must not be sent.
  if (/@example\.(com|org|net)$/i.test(address)) return null;
  return from;
}

function looksLikeKey(value: string): boolean {
  return value.startsWith("re_") || value.length >= 20;
}

/** `RESEND_API_KEY`, `resend`, `resend_api_key`, or any `resend*` that holds a key. */
export function pickApiKey(env: Record<string, string | undefined>): string | null {
  for (const name of KEY_NAMES) {
    const value = env[name]?.trim();
    if (value && looksLikeKey(value)) return value;
  }
  for (const [name, value] of Object.entries(env)) {
    if (typeof value !== "string" || !/resend/i.test(name) || /from/i.test(name)) continue;
    const trimmed = value.trim();
    if (trimmed.startsWith("re_")) return trimmed;
  }
  return null;
}

/** `RESEND_FROM`, `resend_from`, `MAIL_FROM`, or any `*from*` variable holding an address. */
export function pickSender(env: Record<string, string | undefined>): string | null {
  for (const name of FROM_NAMES) {
    const value = usableSender(env[name]);
    if (value) return value;
  }
  for (const [name, value] of Object.entries(env)) {
    if (typeof value !== "string" || !/from/i.test(name)) continue;
    const usable = usableSender(value);
    if (usable) return usable;
  }
  return null;
}

export function keyPreview(apiKey: string | null): string {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return `${apiKey.slice(0, 2)}…`;
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
}

async function errorDetail(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "");
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as { message?: unknown; error?: { message?: unknown } };
    const message =
      typeof parsed.message === "string" ? parsed.message : typeof parsed.error?.message === "string" ? parsed.error.message : "";
    if (message) return message.slice(0, 300);
  } catch {
    // Plain text error from the edge, keep it as is.
  }
  return trimmed.slice(0, 300);
}

export async function listDomains(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; domains: DomainRow[] } | { ok: false; status: number; detail: string }> {
  try {
    const response = await fetchImpl(`${RESEND_API}/domains`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, detail: await errorDetail(response) };
    }
    const body = (await response.json()) as { data?: { name?: unknown; status?: unknown }[] };
    const domains: DomainRow[] = [];
    for (const row of body.data ?? []) {
      if (typeof row.name !== "string" || !row.name) continue;
      domains.push({ name: row.name, status: typeof row.status === "string" ? row.status : "unknown" });
    }
    return { ok: true, domains };
  } catch (error) {
    return { ok: false, status: 0, detail: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "连接 Resend 超时";
    return error.message.slice(0, 300);
  }
  return "连接 Resend 失败";
}

/** Env sender first, then the first verified domain in the Resend account. */
export async function resolveSender(deps: ResolveDeps): Promise<SenderInfo> {
  const { apiKey, from } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const envFrom = usableSender(from);
  if (envFrom) {
    return { from: envFrom, source: "env", detail: "", domains: [] };
  }
  if (!apiKey) {
    return { from: null, source: "none", detail: "还没有配置 Resend 密钥", domains: [] };
  }
  const cacheKey = `${apiKey.slice(0, 6)}:${apiKey.slice(-6)}:${apiKey.length}`;
  const cached = deps.fresh ? undefined : cache.get(cacheKey);
  if (cached && now() - cached.at < KEY_TTL) return cached.info;

  const listed = await listDomains(apiKey, fetchImpl);
  let info: SenderInfo;
  if (!listed.ok) {
    info = {
      from: null,
      source: "none",
      detail: `读取 Resend 域名失败（${listed.status || "网络"}）：${listed.detail}`,
      domains: [],
    };
  } else {
    const verified = listed.domains.find((domain) => domain.status === "verified");
    if (verified) {
      info = { from: `必背诗笺 <pdf@${verified.name}>`, source: "domain", detail: "", domains: listed.domains };
    } else if (listed.domains.length === 0) {
      info = {
        from: null,
        source: "none",
        detail: "Resend 里还没有已验证的发信域名，先在 Resend 添加并验证域名，或设置 RESEND_FROM",
        domains: [],
      };
    } else {
      const status = listed.domains.map((domain) => `${domain.name}（${domain.status}）`).join("、");
      info = { from: null, source: "none", detail: `Resend 域名还没验证：${status}`, domains: listed.domains };
    }
  }
  cache.set(cacheKey, { at: now(), info });
  return info;
}

export type MailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendViaResend(
  apiKey: string,
  message: MailMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  try {
    const response = await fetchImpl(`${RESEND_API}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        reply_to: addressOf(message.from),
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, detail: await errorDetail(response) };
    }
    const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return { ok: true, id: typeof body?.id === "string" ? body.id : null };
  } catch (error) {
    return { ok: false, status: 0, detail: errorMessage(error) };
  }
}

export function addressOf(from: string): string {
  return (from.match(/<([^<>]+)>/)?.[1] ?? from).trim();
}

/** Snapshot for `GET /api/mail-status`. Never returns the key itself. */
export async function mailStatus(deps: {
  apiKey: string | null;
  from: string | null;
  fetchImpl?: typeof fetch;
}): Promise<{
  keyPresent: boolean;
  keyPreview: string;
  sender: string | null;
  senderSource: SenderSource;
  domains: DomainRow[];
  ready: boolean;
  detail: string;
}> {
  const info = await resolveSender({ apiKey: deps.apiKey, from: deps.from, fetchImpl: deps.fetchImpl, fresh: true });
  return {
    keyPresent: Boolean(deps.apiKey),
    keyPreview: keyPreview(deps.apiKey),
    sender: info.from,
    senderSource: info.source,
    domains: info.domains,
    ready: Boolean(deps.apiKey && info.from),
    detail: info.detail,
  };
}
