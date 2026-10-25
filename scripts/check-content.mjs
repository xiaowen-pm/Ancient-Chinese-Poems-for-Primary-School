import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const poems = JSON.parse(readFileSync(join(root, "src/data/poems.json"), "utf8"));
const soon = JSON.parse(readFileSync(join(root, "src/data/soon.json"), "utf8"));
const han = /\p{Script=Han}/u;

function hanCount(value) {
  return [...value].filter((char) => han.test(char)).length;
}

function syllableCount(value) {
  return value.split(/\s+/).filter(Boolean).length;
}

const ids = new Set();
const failures = [];

function fail(message) {
  failures.push(message);
}

function claim(id) {
  if (!id || ids.has(id)) fail(`重复或空的 id：${id}`);
  ids.add(id);
}

for (const poem of poems) {
  claim(poem.id);
  if (syllableCount(poem.titlePinyin) !== hanCount(poem.title)) {
    fail(`${poem.id} 题名拼音 ${syllableCount(poem.titlePinyin)} ≠ 汉字 ${hanCount(poem.title)}（${poem.title}）`);
  }
  if (syllableCount(poem.authorPinyin) !== hanCount(poem.author)) {
    fail(`${poem.id} 作者拼音 ≠ 汉字（${poem.author} / ${poem.authorPinyin}）`);
  }
  if (syllableCount(poem.dynastyPinyin) !== hanCount(poem.dynasty)) {
    fail(`${poem.id} 朝代拼音 ≠ 汉字`);
  }
  if (!poem.lines?.length) fail(`${poem.id} 没有诗句`);
  if (!existsSync(join(root, "public", poem.image))) fail(`缺少图片 ${poem.image}`);
  poem.lines.forEach((line, index) => {
    const tokens = line.pinyin.split(/\s+/).filter(Boolean);
    if (tokens.length !== [...line.text].length) {
      fail(`${poem.id} 第 ${index + 1} 句拼音 ${tokens.length} 个，句子 ${[...line.text].length} 字`);
    }
    if (line.key && !line.text.includes(line.key)) fail(`${poem.id} 第 ${index + 1} 句找不到划线「${line.key}」`);
    if (!line.gloss) fail(`${poem.id} 第 ${index + 1} 句缺少示意 gloss`);
  });
  for (const hot of poem.hotspots ?? []) {
    if (hot.line < 0 || hot.line >= poem.lines.length) fail(`${poem.id} 热点行号越界`);
  }
  for (const track of poem.audio ?? []) {
    if (!existsSync(join(root, "public", track.src))) fail(`缺少音频 ${track.src}`);
    if (track.cues && track.cues.length !== poem.lines.length) fail(`${poem.id} 音频 cues 数量不对`);
  }
  const quizzes = [...(poem.quizzes ?? []), ...(poem.sceneQuiz ? [poem.sceneQuiz] : [])];
  for (const quiz of quizzes) {
    if (quiz.answer < 0 || quiz.answer >= quiz.options.length) fail(`${poem.id} 小测答案越界`);
  }
}

for (const poem of soon) {
  claim(poem.id);
  for (const [label, text, pinyin] of [
    ["题名", poem.title, poem.titlePinyin],
    ["作者", poem.author, poem.authorPinyin],
    ["朝代", poem.dynasty, poem.dynastyPinyin],
  ]) {
    if (syllableCount(pinyin) !== hanCount(text)) fail(`${poem.id} ${label}拼音 ≠ 汉字（${text} / ${pinyin}）`);
  }
  if (poem.firstLine && hanCount(poem.firstLine) < 2) fail(`${poem.id} 首句太短`);
}

const jiangnan = poems.find((poem) => poem.id === "jiangnan");
if (!jiangnan?.audio || jiangnan.audio.length !== 3) fail("《江南》应有跟读、解析、赏析三条音频");
if (!jiangnan?.audio?.[0]?.syncLines) fail("《江南》跟读应打开逐句高亮");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`content ok · ${poems.length} readable · ${soon.length} coming soon`);
