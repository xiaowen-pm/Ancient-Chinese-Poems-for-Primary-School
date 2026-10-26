import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TEXTBOOK_ORDER, nextAutoplayId } from "./grades.ts";
import { normalizeQuery, search } from "./search.ts";
import type { Poem, SoonPoem } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const poems = JSON.parse(readFileSync(join(root, "src/data/poems.json"), "utf8")) as Poem[];
const soon = JSON.parse(readFileSync(join(root, "src/data/soon.json"), "utf8")) as SoonPoem[];

function ids(query: string): { ready: string[]; soon: string[] } {
  const found = search(query, poems, soon);
  return {
    ready: found.ready.map((hit) => hit.poemId),
    soon: found.soon.map((hit) => hit.poemId),
  };
}

assert.equal(normalizeQuery("   "), null);
assert.equal(normalizeQuery("，。"), null);
assert.equal(normalizeQuery("  ｊｎ "), "jn");

const jn = ids("jn");
assert.equal(jn.ready[0], "jiangnan");
assert.ok(jn.ready.includes("jiangnan-chun"));
assert.ok(jn.ready.includes("yijiangnan"));
assert.ok(!jn.soon.includes("jiangnan-chun"));
assert.ok(!jn.soon.includes("yijiangnan"));
assert.ok(!jn.ready.includes("jingye"));
assert.ok(!jn.soon.includes("jingye"));

const lian = ids("莲");
assert.ok(lian.ready.includes("jiangnan"));
assert.equal(search("莲", poems, soon).ready.find((hit) => hit.poemId === "jiangnan")?.lineIndex, 0);

assert.deepEqual(ids("xyz好"), { ready: [], soon: [] });
assert.ok(ids("jingyesi").ready.includes("jingye"));
assert.equal(search("chuangqian", poems, soon).ready[0]?.poemId, "jingye");
assert.equal(search("chuangqian", poems, soon).ready[0]?.lineIndex, 0);

const libai = ids("lb");
assert.ok(libai.ready.includes("jingye"));
assert.ok(libai.ready.includes("zeng-wang-lun"));
assert.ok(!libai.soon.includes("zeng-wang-lun"));
assert.ok(!libai.ready.includes("jiangnan"));

assert.ok(ids("鹅鹅鹅").ready.includes("yong-e"));
assert.ok(!ids("鹅鹅鹅").soon.includes("yong-e"));
assert.ok(ids("锄禾").ready.includes("min-nong-2"));
assert.ok(ids("渭城曲").ready.includes("song-yuaner"));
assert.deepEqual(ids("luzhai").ready, ["luchai"]);
assert.deepEqual(ids("luzhai").soon, []);
assert.deepEqual(ids("luchai").soon, []);
assert.deepEqual(ids("luchai").ready, []);
assert.ok(ids("关雎").soon.includes("guan-ju"));
assert.ok(ids("春夜喜雨").ready.includes("chunye-xiyu"));

const tang = ids("唐");
assert.ok(tang.ready.includes("jingye"));
assert.ok(tang.ready.includes("chunxiao"));
assert.ok(tang.ready.includes("shanxing"));
assert.ok(!tang.ready.includes("jiangnan"));
assert.ok(ids("汉").ready.includes("jiangnan"));
assert.ok(ids("tang").ready.includes("jingye"));
assert.ok(!ids("tang").ready.includes("jiangnan"));

const green: Poem = {
  id: "lv",
  title: "绿",
  author: "试",
  dynasty: "唐",
  titlePinyin: "lǜ",
  authorPinyin: "shì",
  dynastyPinyin: "táng",
  tag: "",
  grade: "extra",
  pageColor: "#fff",
  effect: "leaf",
  image: "",
  lines: [{ text: "绿。", pinyin: "lǜ 。", gloss: "绿" }],
  hotspots: [],
};
for (const query of ["lv", "lu", "lǜ", "lü"]) {
  assert.equal(search(query, [green], []).ready[0]?.poemId, "lv", query);
}

assert.equal(search("<img onerror=alert(1)>", poems, soon).ready.length + search("<img onerror=alert(1)>", poems, soon).soon.length, 0);

for (const poem of poems) {
  if (poem.grade === "extra") {
    for (const ids of Object.values(TEXTBOOK_ORDER)) assert.ok(!ids.includes(poem.id), poem.id);
  } else {
    const listed = TEXTBOOK_ORDER[poem.grade];
    assert.ok(listed?.includes(poem.id), `${poem.id} 不在 ${poem.grade}`);
  }
}
const sample = [
  { id: "a", labels: ["朗读"] },
  { id: "b", labels: ["跟读"] },
  { id: "c", labels: ["朗读", "跟读"] },
];
assert.equal(nextAutoplayId(sample, "a", "朗读"), "c");
assert.equal(nextAutoplayId(sample, "c", "朗读"), null);
assert.equal(nextAutoplayId(sample, "missing", "朗读"), null);

console.log(`search ok · ${poems.length} poems · ${soon.length} coming soon`);
