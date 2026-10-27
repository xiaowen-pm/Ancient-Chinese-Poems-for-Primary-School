import assert from "node:assert/strict";
import {
  FULL_PDF_PATH,
  FULL_PDF_URL,
  PAGE_IMAGE_PATH,
  handlePdfHttp,
  isParentEmail,
  memorySignupStore,
  pdfLinks,
  pdfTarget,
  poemTitle,
  printableSheetName,
  routeApi,
  submitPdfSignup,
  type SignupRecord,
} from "./pdfSignup.ts";
import { pickApiKey, pickSender, resolveSender, usableSender, type DomainRow } from "./resend.ts";

assert.equal(isParentEmail("parent@example.com"), true);
assert.equal(isParentEmail("  Parent@School.edu.cn "), true);
assert.equal(isParentEmail("not-an-email"), false);
assert.equal(isParentEmail("a@b"), false);
assert.equal(isParentEmail("a@b.c"), false);
assert.equal(isParentEmail("spaced name@example.com"), false);
const badEmail = await submitPdfSignup(
  { email: "nope", company: "", poemId: "jingye", sheet: "", ip: "203.0.113.9", origin: null, host: "bibei.example" },
  { store: memorySignupStore() },
);
assert.equal(badEmail.status, 400);
assert.equal(badEmail.ok, false);
assert.match(badEmail.message, /邮箱/);

assert.equal(printableSheetName("1、《咏鹅》.jpg"), "1、《咏鹅》.jpg");
assert.equal(printableSheetName("../secret.jpg"), null);
assert.equal(printableSheetName("notes.pdf"), null);

assert.ok(FULL_PDF_URL.includes("%2B"));
assert.ok(FULL_PDF_URL.endsWith(encodeURIComponent("02必背古诗词75首-PDF版.pdf")));

// The dashboard may keep the key as `resend`; both spellings must work.
assert.equal(pickApiKey({ RESEND_API_KEY: "re_env_key" }), "re_env_key");
assert.equal(pickApiKey({ resend: "re_dashboard_key" }), "re_dashboard_key");
assert.equal(pickApiKey({ Resend: "re_capital_key" }), "re_capital_key");
assert.equal(pickApiKey({ my_resend: "re_odd_name" }), "re_odd_name");
assert.equal(pickApiKey({ RESEND_FROM: "必背诗笺 <pdf@bibei.example>" }), null);
assert.equal(pickApiKey({}), null);

// A leftover template address must never become the sender.
assert.equal(usableSender("必背诗笺 <pdf@example.com>"), null);
assert.equal(usableSender("pdf@bibei.example"), "pdf@bibei.example");
assert.equal(usableSender("必背诗笺 <pdf@bibei.example>"), "必背诗笺 <pdf@bibei.example>");
assert.equal(usableSender(""), null);
assert.equal(pickSender({ RESEND_FROM: "必背诗笺 <pdf@example.com>" }), null);
assert.equal(pickSender({ resend_from: "诗笺 <pdf@mail.bibei.example>" }), "诗笺 <pdf@mail.bibei.example>");
assert.equal(pickSender({ MAIL_FROM: "pdf@mail.bibei.example" }), "pdf@mail.bibei.example");

assert.equal(poemTitle("江南\nBcc: x@y.z"), "江南Bcc: x@y.z");
assert.equal(poemTitle("<script>"), "script");

const links = pdfLinks("1、《咏鹅》.jpg", "https://bibei.example");
assert.equal(links[0]?.href, "https://bibei.example/api/pdf/full.pdf");
assert.match(links[1]?.href ?? "", /\/api\/pdf\/page\.jpg\?name=.*%E5%92%8F%E9%B9%85/);
assert.equal(pdfLinks(null).length, 1);

const emptyStore = memorySignupStore();
const first = await submitPdfSignup(sample("parent@example.com"), {
  store: emptyStore,
  now: () => new Date("2026-10-26T00:00:00.000Z"),
});
assert.equal(first.status, 200);
assert.equal(first.stored, true);
assert.equal(first.emailed, false);
assert.match(first.message, /还没接通/);
assert.match(first.detail, /密钥/);
assert.match(first.links[0]?.href ?? "", /\/api\/pdf\/full\.pdf$/);
assert.match(first.links[1]?.href ?? "", /%E5%92%8F%E9%B9%85/);

const saved = JSON.parse((await emptyStore.get("signup:parent@example.com")) ?? "") as SignupRecord;
assert.equal(saved.source, "web:yong-e");
assert.equal(saved.createdAt, "2026-10-26T00:00:00.000Z");

const again = await submitPdfSignup(sample("Parent@Example.com"), {
  store: emptyStore,
  now: () => new Date("2026-10-26T01:00:00.000Z"),
});
assert.equal(again.stored, true);
const updated = JSON.parse((await emptyStore.get("signup:parent@example.com")) ?? "") as SignupRecord;
assert.equal(updated.createdAt, saved.createdAt);
assert.equal(updated.updatedAt, "2026-10-26T01:00:00.000Z");

const hidden = await submitPdfSignup({ ...sample("bot@example.com"), company: "acme" }, { store: emptyStore });
assert.equal(hidden.ok, true);
assert.equal(hidden.stored, false);
assert.equal(await emptyStore.get("signup:bot@example.com"), null);

// Explicit sender: one request to Resend, with the poem in the subject.
const envCalls: string[] = [];
const mailed = await submitPdfSignup(sample("mail@school.cn"), {
  store: memorySignupStore(),
  resendApiKey: "re_env_sender",
  resendFrom: "必背诗笺 <pdf@bibei.example>",
  fetchImpl: async (url, init) => {
    envCalls.push(String(url));
    assert.equal(String(url), "https://api.resend.com/emails");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer re_env_sender");
    const body = JSON.parse(String(init?.body)) as { to: string[]; from: string; subject: string; text: string; html: string };
    assert.deepEqual(body.to, ["mail@school.cn"]);
    assert.equal(body.from, "必背诗笺 <pdf@bibei.example>");
    assert.equal(body.subject, "《咏鹅》可打印 PDF（带拼音和译文）");
    assert.match(body.text, /\/api\/pdf\/full\.pdf/);
    assert.match(body.html, /page\.jpg/);
    return new Response(JSON.stringify({ id: "m1" }), { status: 200 });
  },
});
assert.deepEqual(envCalls, ["https://api.resend.com/emails"]);
assert.equal(mailed.emailed, true);
assert.match(mailed.message, /mail@school\.cn/);
assert.equal(mailed.detail, "");

// No sender configured: ask Resend for a verified domain and use it.
const derived = await submitPdfSignup(sample("domain@school.cn"), {
  store: memorySignupStore(),
  resendApiKey: "re_derived_key",
  fetchImpl: stubFetch({ domains: [{ name: "bibei.example", status: "verified" }] }),
});
assert.equal(derived.emailed, true);
assert.equal(derived.detail, "");

// Verified domains that are only pending must not be used as a sender.
const pending = await submitPdfSignup(sample("pending@school.cn"), {
  store: memorySignupStore(),
  resendApiKey: "re_pending_key",
  fetchImpl: stubFetch({ domains: [{ name: "bibei.example", status: "pending" }] }),
});
assert.equal(pending.emailed, false);
assert.match(pending.detail, /还没验证/);
assert.match(pending.detail, /bibei\.example/);

// Resend rejecting the message must not look like a delivered mail.
const rejected = await submitPdfSignup(sample("reject@school.cn"), {
  store: memorySignupStore(),
  resendApiKey: "re_reject_key",
  resendFrom: "必背诗笺 <pdf@bibei.example>",
  fetchImpl: async () =>
    new Response(JSON.stringify({ message: "The bibei.example domain is not verified", statusCode: 403 }), { status: 403 }),
});
assert.equal(rejected.emailed, false);
assert.match(rejected.detail, /Resend 403/);
assert.match(rejected.detail, /not verified/);
assert.match(rejected.message, /暂时没发出/);

// An invalid key surfaces Resend's own words instead of a silent failure.
const badKey = await resolveSender({
  apiKey: "re_bad_key",
  from: null,
  fetchImpl: async () => new Response(JSON.stringify({ message: "API key is invalid", statusCode: 400 }), { status: 400 }),
});
assert.equal(badKey.from, null);
assert.match(badKey.detail, /API key is invalid/);

let sendAttempts = 0;
const limitedMail = memorySignupStore();
for (let i = 0; i < 4; i += 1) {
  const response = await submitPdfSignup({ ...sample("throttle@school.cn"), ip: `203.0.113.5${i}` }, {
    store: limitedMail,
    resendApiKey: "re_throttle_key",
    resendFrom: "必背诗笺 <pdf@bibei.example>",
    fetchImpl: async () => {
      sendAttempts += 1;
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(response.status, 200);
}
assert.equal(sendAttempts, 3);

const limited = memorySignupStore();
for (let i = 0; i < 8; i += 1) {
  const response = await submitPdfSignup({ ...sample(`n${i}@school.cn`), ip: "203.0.113.8" }, { store: limited });
  assert.equal(response.status, 200);
}
const blocked = await submitPdfSignup({ ...sample("more@school.cn"), ip: "203.0.113.8" }, { store: limited });
assert.equal(blocked.status, 429);

const request = new Request("https://bibei.example/api/pdf-request", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    host: "bibei.example",
    origin: "https://bibei.example",
    "cf-connecting-ip": "198.51.100.4",
  },
  body: JSON.stringify({ email: "http@school.cn", poemId: "jingye", company: "" }),
});
const httpStore = memorySignupStore();
const viaHttp = await handlePdfHttp(request, { store: httpStore });
assert.equal(viaHttp.status, 200);
const viaBody = (await viaHttp.json()) as { emailed: boolean; links: { href: string }[]; detail: string };
assert.equal(viaBody.emailed, false);
assert.equal(viaBody.links[0]?.href, "https://bibei.example/api/pdf/full.pdf");
assert.equal(viaBody.links.length, 1);

const foreign = new Request("https://bibei.example/api/pdf-request", {
  method: "POST",
  headers: { "content-type": "application/json", host: "bibei.example", origin: "https://evil.example" },
  body: JSON.stringify({ email: "parent@school.cn" }),
});
assert.equal((await handlePdfHttp(foreign, { store: memorySignupStore() })).status, 403);

// Download routes always point at this site, never at a third party.
const full = pdfTarget(new URL(`https://bibei.example${FULL_PDF_PATH}`));
assert.ok(full && "target" in full);
assert.equal(full.target.url, FULL_PDF_URL);
assert.equal(full.target.type, "application/pdf");
const page = pdfTarget(new URL(`https://bibei.example${PAGE_IMAGE_PATH}?name=${encodeURIComponent("1、《咏鹅》.jpg")}`));
assert.ok(page && "target" in page);
assert.match(page.target.url, /%E5%92%8F%E9%B9%85/);
const noName = pdfTarget(new URL(`https://bibei.example${PAGE_IMAGE_PATH}`));
assert.ok(noName && "status" in noName);
assert.equal(noName.status, 400);
assert.equal(pdfTarget(new URL("https://bibei.example/api/pdf/other.pdf")), null);

const servedPage = await routeApi(
  new Request(`https://bibei.example${PAGE_IMAGE_PATH}?name=${encodeURIComponent("1、《咏鹅》.jpg")}`),
  {
    env: {},
    fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
  },
);
assert.equal(servedPage?.status, 200);
assert.equal(servedPage?.headers.get("content-type"), "image/jpeg");
assert.match(servedPage?.headers.get("content-disposition") ?? "", /filename\*=UTF-8''/);

const status = await routeApi(new Request("https://bibei.example/api/mail-status"), {
  env: { resend: "re_status_key" },
  fetchImpl: stubFetch({ domains: [{ name: "bibei.example", status: "verified" }] }),
});
assert.equal(status?.status, 200);
const statusBody = (await status?.json()) as {
  ready: boolean;
  sender: string;
  keyPreview: string;
  keyPresent: boolean;
  domains: DomainRow[];
};
assert.equal(statusBody.ready, true);
assert.equal(statusBody.keyPresent, true);
assert.equal(statusBody.sender, "必背诗笺 <pdf@bibei.example>");
assert.ok(!statusBody.keyPreview.includes("re_status_key"));
assert.equal(statusBody.domains[0]?.name, "bibei.example");

assert.equal(await routeApi(new Request("https://bibei.example/other")), null);

let clock = 0;
const expiring = memorySignupStore(() => clock);
await expiring.put("rate:1", "1", { expirationTtl: 10 });
clock = 10_000;
assert.equal(await expiring.get("rate:1"), null);

function sample(email: string) {
  return {
    email,
    company: "",
    poemId: "yong-e",
    sheet: "1、《咏鹅》.jpg",
    title: "咏鹅",
    ip: "203.0.113.10",
    origin: null,
    host: "bibei.example",
  };
}

function stubFetch(options: { domains?: DomainRow[]; domainsStatus?: number; emailsStatus?: number }): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/domains")) {
      return new Response(JSON.stringify({ data: options.domains ?? [] }), { status: options.domainsStatus ?? 200 });
    }
    if (url.endsWith("/emails")) {
      return new Response(JSON.stringify({ id: "stub" }), { status: options.emailsStatus ?? 200 });
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
}
