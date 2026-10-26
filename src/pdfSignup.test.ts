import assert from "node:assert/strict";
import {
  FULL_PDF_URL,
  handlePdfHttp,
  isParentEmail,
  memorySignupStore,
  printableSheetName,
  submitPdfSignup,
  type SignupRecord,
} from "./pdfSignup.ts";

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

const store = memorySignupStore();
const first = await submitPdfSignup(sample("parent@example.com"), { store, now: () => new Date("2026-10-26T00:00:00.000Z") });
assert.equal(first.status, 200);
assert.equal(first.stored, true);
assert.equal(first.emailed, false);
assert.match(first.message, /还没接通/);
assert.equal(first.links[0]?.href, FULL_PDF_URL);
assert.match(first.links[1]?.href ?? "", /%E5%92%8F%E9%B9%85/);

const saved = JSON.parse((await store.get("signup:parent@example.com")) ?? "") as SignupRecord;
assert.equal(saved.source, "web:yong-e");
assert.equal(saved.createdAt, "2026-10-26T00:00:00.000Z");

const again = await submitPdfSignup(sample("Parent@Example.com"), { store, now: () => new Date("2026-10-26T01:00:00.000Z") });
assert.equal(again.stored, true);
const updated = JSON.parse((await store.get("signup:parent@example.com")) ?? "") as SignupRecord;
assert.equal(updated.createdAt, saved.createdAt);
assert.equal(updated.updatedAt, "2026-10-26T01:00:00.000Z");
const keys = ["signup:parent@example.com"];
assert.equal(keys.length, 1);

const hidden = await submitPdfSignup({ ...sample("bot@example.com"), company: "acme" }, { store });
assert.equal(hidden.ok, true);
assert.equal(hidden.stored, false);
assert.equal(await store.get("signup:bot@example.com"), null);

let calls = 0;
const mailed = await submitPdfSignup(sample("mail@school.cn"), {
  store,
  resendApiKey: "re_test",
  resendFrom: "必背诗笺 <pdf@bibei.example>",
  fetchImpl: async (url, init) => {
    calls += 1;
    assert.equal(url, "https://api.resend.com/emails");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer re_test");
    const body = JSON.parse(String(init?.body)) as { to: string[]; text: string; from: string };
    assert.deepEqual(body.to, ["mail@school.cn"]);
    assert.match(body.text, /75 首必背古诗词 PDF/);
    assert.ok(body.text.includes(FULL_PDF_URL));
    assert.equal(body.from, "必背诗笺 <pdf@bibei.example>");
    return new Response("{}", { status: 200 });
  },
});
assert.equal(calls, 1);
assert.equal(mailed.emailed, true);

const placeholder = await submitPdfSignup(sample("hold@school.cn"), {
  store,
  resendApiKey: "re_test",
  resendFrom: "必背诗笺 <pdf@example.com>",
  fetchImpl: async () => {
    throw new Error("should not send from example.com");
  },
});
assert.equal(placeholder.emailed, false);
assert.match(placeholder.message, /还没接通/);

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
const viaBody = (await viaHttp.json()) as { emailed: boolean; links: { href: string }[] };
assert.equal(viaBody.emailed, false);
assert.equal(viaBody.links[0]?.href, FULL_PDF_URL);
assert.equal(viaBody.links.length, 1);

const foreign = new Request("https://bibei.example/api/pdf-request", {
  method: "POST",
  headers: { "content-type": "application/json", host: "bibei.example", origin: "https://evil.example" },
  body: JSON.stringify({ email: "parent@school.cn" }),
});
assert.equal((await handlePdfHttp(foreign, { store: memorySignupStore() })).status, 403);

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
    ip: "203.0.113.10",
    origin: null,
    host: "bibei.example",
  };
}
