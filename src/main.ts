import "./style.css";
import { asset, findPoem, findSoon, poems, sheetUrl, soonPoems } from "./data.ts";
import { startEffects } from "./effects.ts";
import { escapeHtml, rich } from "./html.ts";
import { GRADE_CHIPS, TEXTBOOK_ORDER, gradeLabel, isGradeFilter, nextAutoplayId, type GradeFilter } from "./grades.ts";
import { ReaderAudio } from "./player.ts";
import { normalizeQuery, search, type ReadyHit, type SoonHit, type Span } from "./search.ts";
import type { AudioTrack, Poem, Quiz, SoonPoem } from "./types.ts";

const $ = <T extends HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少 #${id}`);
  return node as T;
};

const gradesNav = $<HTMLElement>("grades");
const autoplayBtn = $<HTMLButtonElement>("autoplay");
const AUTOPLAY_KEY = "bibei-autoplay-next";
const scene = $<HTMLElement>("scene");
const sceneImg = $<HTMLImageElement>("scene-img");
const scenePlate = $<HTMLElement>("scene-plate");
const fx = $<HTMLCanvasElement>("fx");
const sheetLink = $<HTMLAnchorElement>("sheet-link");
const hots = $<HTMLElement>("hots");
const lines = $<HTMLElement>("lines");
const tabs = $<HTMLElement>("tabs");
const panel = $<HTMLElement>("panel");
const mode = $<HTMLElement>("mode");
const player = $<HTMLElement>("player");
const tname = $<HTMLElement>("tname");
const playBtn = $<HTMLButtonElement>("play");
const seek = $<HTMLElement>("seek");
const progress = $<HTMLElement>("pr");
const stamp = $<HTMLElement>("stamp");
const pyBtn = $<HTMLButtonElement>("py-toggle");
const cards = $<HTMLElement>("cards");
const soonRoot = $<HTMLElement>("soon-root");
const sources = $<HTMLElement>("sources");
const dd = $<HTMLElement>("dd");
const srch = $<HTMLElement>("srch");
const queryInput = $<HTMLInputElement>("q");
const modal = $<HTMLElement>("modal");
const sheet = $<HTMLElement>("sheet");

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩";
const DYNASTY_ORDER = ["先秦", "汉", "三国", "北朝", "唐", "宋", "元", "明", "清"];

let gradeFilter: GradeFilter = "all";
let autoplayNext = readStoredAutoplay();
let poemIndex = 0;
let line = 0;
let tab = 0;
let pinyinOn = true;
let trackIndex = 0;
let imgToken = 0;
let readyHits: ReadyHit[] = [];
let soonHits: SoonHit[] = [];
let sel = 0;
let lastFocus: HTMLElement | null = null;

const reader = new ReaderAudio({
  onTime: onAudioTick,
  onEnd: onAudioEnd,
  onError: onAudioError,
  onPlayState: (playing) => {
    paintPlay(playing);
    paintTrackName();
  },
});

function readStoredAutoplay(): boolean {
  try {
    return localStorage.getItem(AUTOPLAY_KEY) === "1";
  } catch {
    return false;
  }
}

function current(): Poem {
  return poems[poemIndex] ?? poems[0]!;
}

function visiblePoems(): Poem[] {
  if (gradeFilter === "all") return poems;
  if (gradeFilter === "extra") return poems.filter((poem) => poem.grade === "extra");
  const order = TEXTBOOK_ORDER[gradeFilter];
  return order.flatMap((id) => {
    const poem = poems.find((item) => item.id === id);
    return poem ? [poem] : [];
  });
}

function paintGrades(): void {
  gradesNav.innerHTML = `<div class="grade-row">${GRADE_CHIPS.map(
    (chip) =>
      `<button type="button" data-grade="${chip.id}" class="${chip.id === gradeFilter ? "on" : ""}" aria-pressed="${chip.id === gradeFilter ? "true" : "false"}">${chip.label}</button>`,
  ).join("")}</div>`;
  const row = gradesNav.querySelector<HTMLElement>(".grade-row");
  const selected = gradesNav.querySelector<HTMLElement>(".on");
  if (!row || !selected) return;
  const rowRect = row.getBoundingClientRect();
  const selectedRect = selected.getBoundingClientRect();
  row.scrollLeft += selectedRect.left - rowRect.left - rowRect.width / 2 + selectedRect.width / 2;
}

function paintAutoplay(): void {
  autoplayBtn.classList.toggle("on", autoplayNext);
  autoplayBtn.setAttribute("aria-pressed", autoplayNext ? "true" : "false");
  autoplayBtn.setAttribute("aria-label", autoplayNext ? "连播已开，播完自动下一首" : "连播已关");
}

function setGrade(next: GradeFilter): void {
  gradeFilter = next;
  paintGrades();
  const list = visiblePoems();
  if (!list.some((poem) => poem.id === current().id) && list[0]) {
    const index = poems.findIndex((poem) => poem.id === list[0]?.id);
    if (index >= 0) {
      goTo(index, 0);
      return;
    }
  }
  renderGallery();
  writeUrl();
}

type TabSpec = { id: string; label: string };

function tabsFor(poem: Poem): TabSpec[] {
  const hasNote = poem.lines.some((item) => item.note);
  const commentary = Boolean(hasNote || poem.appreciation?.length || poem.background || poem.quizzes?.length);
  // 静夜思、春晓、山行既有注释，也要留下原来的画境、小剧场和看画猜诗。
  const keepsGallery = Boolean(poem.story || poem.sceneQuiz) && !poem.quizzes?.length;
  if (commentary && keepsGallery) {
    const tabs: TabSpec[] = [];
    if (poem.lines.some((item) => item.gloss)) tabs.push({ id: "gloss", label: "逐句画境" });
    if (hasNote) tabs.push({ id: "notes", label: "注释" });
    if (poem.translation) tabs.push({ id: "translation", label: "译文" });
    if (poem.appreciation?.length) tabs.push({ id: "appreciation", label: "赏析" });
    if (poem.story) tabs.push({ id: "story", label: "诗人小剧场" });
    if (poem.sceneQuiz) tabs.push({ id: "quiz", label: "看画猜诗 · 盖章" });
    return tabs;
  }
  if (commentary) {
    return [
      { id: "notes", label: "注释" },
      { id: "translation", label: "译文" },
      { id: "appreciation", label: "赏析" },
      { id: "background", label: "背景" },
      { id: "quizzes", label: "小测" },
    ];
  }
  const tabs: TabSpec[] = [{ id: "gloss", label: "逐句画境" }];
  if (poem.translation) tabs.push({ id: "translation", label: "译文" });
  if (poem.story || poem.sceneQuiz || !poem.translation) {
    tabs.push({ id: "story", label: "诗人小剧场" });
    tabs.push({ id: "quiz", label: "看画猜诗 · 盖章" });
  }
  return tabs;
}

function plateText(title: string): string {
  const chars = [...title];
  return chars.length <= 4 ? title : chars.slice(0, 2).join("");
}

function rubyLine(text: string, pinyin: string, key?: string): string {
  const chars = [...text];
  const tokens = pinyin.split(" ");
  const keyAt = key ? text.indexOf(key) : -1;
  const keyLen = key ? [...key].length : 0;
  return chars
    .map((ch, index) => {
      const token = /[，。、！？]/.test(ch) ? "" : (tokens[index] ?? "");
      const body = `<ruby>${escapeHtml(ch)}<rt>${escapeHtml(token)}</rt></ruby>`;
      const marked = keyAt >= 0 && index >= keyAt && index < keyAt + keyLen;
      return marked ? `<span class="key">${body}</span>` : body;
    })
    .join("");
}

function mark(text: string, span: Span | null): string {
  if (!span) return escapeHtml(text);
  const chars = [...text];
  const [start, len] = span;
  return `${escapeHtml(chars.slice(0, start).join(""))}<mark>${escapeHtml(chars.slice(start, start + len).join(""))}</mark>${escapeHtml(chars.slice(start + len).join(""))}`;
}

function showImage(poem: Poem): void {
  const token = ++imgToken;
  scene.classList.remove("missing-img", "plain");
  sceneImg.classList.remove("show");
  fx.dataset.plain = poem.image ? "0" : "1";
  if (!poem.image) {
    scene.classList.add("plain");
    scene.style.setProperty("--plate", poem.pageColor);
    sceneImg.removeAttribute("src");
    sceneImg.alt = "";
    scenePlate.hidden = false;
    scenePlate.innerHTML = `<i class="mark">${escapeHtml(poem.dynasty)}</i><strong>${escapeHtml(poem.title)}</strong><span class="by">${escapeHtml(poem.dynasty)} · ${escapeHtml(poem.author)}</span>`;
    return;
  }
  scenePlate.hidden = true;
  scenePlate.innerHTML = "";
  scene.style.removeProperty("--plate");
  sceneImg.alt = `${poem.title}诗意图，${poem.author}`;
  const src = asset(poem.image);
  const reveal = () => {
    if (token !== imgToken) return;
    window.requestAnimationFrame(() => sceneImg.classList.add("show"));
  };
  sceneImg.onload = reveal;
  sceneImg.onerror = () => {
    if (token !== imgToken) return;
    scene.classList.add("missing-img");
  };
  if (sceneImg.dataset.src === src && sceneImg.complete && sceneImg.naturalWidth > 0) reveal();
  sceneImg.dataset.src = src;
  sceneImg.src = src;
}

function paintPlay(playing: boolean): void {
  playBtn.textContent = playing ? "❚❚" : "▶";
  playBtn.setAttribute("aria-label", playing ? "暂停" : "播放");
  playBtn.setAttribute("aria-pressed", playing ? "true" : "false");
}

function paintProgress(percent: number): void {
  const clamped = Math.max(0, Math.min(100, percent));
  progress.style.width = `${clamped}%`;
  seek.setAttribute("aria-valuenow", String(Math.round(clamped)));
}

function paintTransport(): void {
  const ready = Boolean(current().audio?.length);
  player.classList.toggle("is-silent", !ready);
  playBtn.disabled = !ready;
  playBtn.tabIndex = ready ? 0 : -1;
  playBtn.setAttribute("aria-hidden", ready ? "false" : "true");
}

function paintTrackName(override?: string): void {
  const poem = current();
  paintTransport();
  if (override) {
    tname.textContent = `${poem.title} · ${override}`;
    return;
  }
  const track = poem.audio?.[trackIndex];
  tname.textContent = track ? `${poem.title} · ${track.label}` : `${poem.title} · 朗读还在录制`;
}

function renderModes(): void {
  const tracks = current().audio;
  if (tracks?.length) {
    mode.innerHTML = tracks
      .map(
        (item, index) =>
          `<button type="button" data-track="${index}" class="${index === trackIndex ? "on" : ""}">${escapeHtml(item.label)}</button>`,
      )
      .join("");
    return;
  }
  mode.innerHTML = `<button type="button" data-track="quiet">纯享画境</button>`;
}

function renderLines(): void {
  const poem = current();
  lines.innerHTML = poem.lines
    .map(
      (item, index) =>
        `<button type="button" class="line${index === line ? " on" : ""}" data-line="${index}">${rubyLine(item.text, item.pinyin, item.key)}</button>`,
    )
    .join("");
  lines.classList.toggle("nopy", !pinyinOn);
}

function renderHots(): void {
  hots.innerHTML = current()
    .hotspots.map((hot, index) => {
      const markNo = CIRCLED[index] ?? String(index + 1);
      const on = hot.line === line ? " on" : "";
      return `<button type="button" class="hot${on}" style="left:${hot.x}%;top:${hot.y}%" data-line="${hot.line}"><i>${markNo}</i>${escapeHtml(hot.label)}</button>`;
    })
    .join("");
}

function paintLine(): void {
  lines.querySelectorAll<HTMLElement>("[data-line]").forEach((node) => {
    node.classList.toggle("on", Number(node.dataset.line) === line);
  });
  hots.querySelectorAll<HTMLElement>("[data-line]").forEach((node) => {
    node.classList.toggle("on", Number(node.dataset.line) === line);
  });
}

function renderTabs(): void {
  const list = tabsFor(current());
  if (tab >= list.length) tab = 0;
  tabs.innerHTML = list
    .map(
      (item, index) =>
        `<button type="button" role="tab" data-tab="${index}" class="${index === tab ? "on" : ""}" aria-selected="${index === tab ? "true" : "false"}">${escapeHtml(item.label)}</button>`,
    )
    .join("");
}

function pending(copy = "这一栏还在整理，稍后补上。"): string {
  return `<p class="pending">${copy}</p>`;
}

function quizBlock(quiz: Quiz, quizId: string, numbered?: number): string {
  const options = quiz.options
    .map(
      (option, choice) =>
        `<button type="button" data-quiz="${escapeHtml(quizId)}" data-choice="${choice}">${escapeHtml(option)}</button>`,
    )
    .join("");
  const label = numbered ? `${numbered}. ${escapeHtml(quiz.question)}` : escapeHtml(quiz.question);
  return `<div class="note">${label}</div><div class="opts">${options}</div>`;
}

function panelHtml(poem: Poem, id: string): string {
  const currentLine = poem.lines[line];
  if (id === "gloss") {
    if (!currentLine) return pending();
    return `<div class="kicker">第 ${line + 1} 句 · 诗中有画</div><p>${rich(currentLine.gloss)}</p>`;
  }
  if (id === "story") return poem.story ? `<p>${rich(poem.story)}</p>` : pending("诗人小剧场还在写。");
  if (id === "quiz") return poem.sceneQuiz ? quizBlock(poem.sceneQuiz, "scene") : pending("看画猜诗还在整理。");
  if (id === "notes") {
    if (!currentLine) return pending();
    const note = currentLine.note ? rich(currentLine.note) : "这句的注释还在整理。";
    return `<div class="kicker">第 ${line + 1} 句 · 注释</div><div class="note">${note}</div>`;
  }
  if (id === "translation") return poem.translation ? `<div class="note">${rich(poem.translation)}</div>` : pending("译文还在整理。");
  if (id === "appreciation") {
    if (!poem.appreciation?.length) return pending("赏析还在整理。");
    return poem.appreciation.map((item) => `<div class="note">${rich(item)}</div>`).join("");
  }
  if (id === "background") return poem.background ? `<div class="note">${rich(poem.background)}</div>` : pending("背景还在整理。");
  if (id === "quizzes") {
    if (!poem.quizzes?.length) return pending("小测还在整理。");
    return poem.quizzes.map((quiz, index) => quizBlock(quiz, String(index), index + 1)).join("");
  }
  return pending();
}

function renderPanel(): void {
  const list = tabsFor(current());
  const active = list[tab] ?? list[0];
  panel.innerHTML = active ? panelHtml(current(), active.id) : pending();
}

function renderIdentity(): void {
  const poem = current();
  $<HTMLElement>("tag").textContent = poem.tag;
  $<HTMLElement>("title").textContent = poem.title;
  $<HTMLElement>("author").innerHTML = `<em>${escapeHtml(poem.dynasty)}</em>${escapeHtml(poem.author)}`;
  document.title = `${poem.title} · 必背诗笺`;
  document.body.style.background = poem.pageColor;
  if (poem.sheet) {
    sheetLink.hidden = false;
    sheetLink.href = sheetUrl(poem.sheet);
  } else {
    sheetLink.hidden = true;
    sheetLink.removeAttribute("href");
  }
}

function renderSources(): void {
  const poem = current();
  if (!poem.sources?.length) {
    sources.textContent = poem.story
      ? "这一首的注释还没逐条注明出处。画境和诗人小剧场是给孩子改写的，不是课本原文。"
      : "这一首的注释还没逐条注明出处。画境和译文是给孩子改写的，不是课本原文。";
    return;
  }
  const links = poem.sources
    .map(
      (item) =>
        `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>（${escapeHtml(item.used)}）`,
    )
    .join(" · ");
  sources.innerHTML = `《${escapeHtml(poem.title)}》的注释、译文和赏析根据公开资料改写成儿童读法，核对过：${links}。`;
}

function cardFace(poem: Poem): string {
  if (poem.image) return `<img src="${asset(poem.image)}" alt="${escapeHtml(poem.title)}诗意图">`;
  return `<div class="card-plate" style="--plate:${escapeHtml(poem.pageColor)}">${escapeHtml(plateText(poem.title))}</div>`;
}

function renderGallery(): void {
  const list = visiblePoems();
  cards.innerHTML = list
    .map((poem) => {
      const index = poems.findIndex((item) => item.id === poem.id);
      const first = poem.lines[0]?.text ?? "";
      const currentClass = index === poemIndex ? " is-current" : "";
      return `<button type="button" class="card${currentClass}" data-poem="${index}">${cardFace(poem)}<span><b>${escapeHtml(poem.title)}</b><small>${escapeHtml(poem.dynasty)} · ${escapeHtml(poem.author)} ｜ ${escapeHtml(first)}</small></span></button>`;
    })
    .join("");
  const label = gradeLabel(gradeFilter);
  $<HTMLElement>("gallery-lead").textContent =
    gradeFilter === "all"
      ? `这 ${poems.length} 首可以读，都能点开看画卷。上面的年级按部编版小学语文分成上下册，课外是课本里没有的拓展。`
      : gradeFilter === "extra"
        ? `课外 / 拓展 ${list.length} 首。这几首不在部编版小学课本里。`
        : `${label} · 部编版这一册 ${list.length} 首。连播会按这个顺序往下听。`;
}

function renderSoonList(): void {
  const groups = new Map<string, SoonPoem[]>();
  for (const poem of soonPoems) {
    const list = groups.get(poem.dynasty) ?? [];
    list.push(poem);
    groups.set(poem.dynasty, list);
  }
  const names = [...groups.keys()].sort((a, b) => {
    const ai = DYNASTY_ORDER.indexOf(a);
    const bi = DYNASTY_ORDER.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  soonRoot.innerHTML = names
    .map((name) => {
      const chips = (groups.get(name) ?? [])
        .map(
          (poem) =>
            `<button type="button" class="soon-chip" data-soon="${escapeHtml(poem.id)}">${escapeHtml(poem.title)}<small>${escapeHtml(poem.author)}</small></button>`,
        )
        .join("");
      return `<div class="soon-group"><h3>${escapeHtml(name)}</h3><div class="soon-chips">${chips}</div></div>`;
    })
    .join("");
}

function renderLeads(): void {
  $<HTMLElement>("soon-lead").textContent =
    `下面 ${soonPoems.length} 首已经能搜到篇名和首句。点开不会假装有全文。拼音、注释、朗读和画卷还没做。这不是官方 155 首的完整目录。`;
}

function loadTrack(): void {
  paintProgress(0);
  paintPlay(false);
  const track = current().audio?.[trackIndex];
  if (!track) {
    reader.stop();
    return;
  }
  reader.load(asset(track.src));
}

function renderStage(): void {
  renderIdentity();
  renderLines();
  renderHots();
  renderTabs();
  renderPanel();
  renderModes();
  paintTrackName();
  renderSources();
}

function enterQuiet(): void {
  reader.stop();
  paintPlay(false);
  scene.classList.add("is-quiet");
}

function exitQuiet(): void {
  scene.classList.remove("is-quiet");
}

function lineAt(poem: Poem, track: AudioTrack, time: number, duration: number): number {
  const total = poem.lines.length;
  if (track.cues && track.cues.length === total) {
    let index = 0;
    for (let i = 0; i < total; i += 1) if (time >= (track.cues[i] ?? 0)) index = i;
    return index;
  }
  if (duration <= 0 || total === 0) return 0;
  return Math.min(total - 1, Math.max(0, Math.floor((time / duration) * total)));
}

function onAudioTick(currentTime: number, duration: number): void {
  const poem = current();
  const track = poem.audio?.[trackIndex];
  if (!track || !reader.isPlaying) return;
  paintProgress(duration > 0 ? (currentTime / duration) * 100 : 0);
  if (!track.syncLines) return;
  const next = lineAt(poem, track, currentTime, duration);
  if (next === line) return;
  line = next;
  paintLine();
  const active = tabsFor(poem)[tab];
  if (active && (active.id === "notes" || active.id === "gloss")) renderPanel();
}

function onAudioEnd(): void {
  line = 0;
  paintProgress(0);
  paintLine();
  paintPlay(false);
  const active = tabsFor(current())[tab];
  if (active && (active.id === "notes" || active.id === "gloss")) renderPanel();
  if (!autoplayNext) return;
  const label = current().audio?.[trackIndex]?.label;
  if (!label) return;
  const nextId = nextAutoplayId(
    visiblePoems().map((poem) => ({ id: poem.id, labels: (poem.audio ?? []).map((track) => track.label) })),
    current().id,
    label,
  );
  if (!nextId) {
    paintTrackName("这一册听完了");
    return;
  }
  const index = poems.findIndex((poem) => poem.id === nextId);
  if (index < 0) return;
  goTo(index, 0, { keepLabel: label });
  void reader.play().then((started) => {
    if (!started) paintTrackName("点一下播放，接着听下一首");
  });
}

function onAudioError(): void {
  paintPlay(false);
  paintTrackName("音频加载失败");
}

function pickLine(index: number): void {
  const poem = current();
  if (!poem.lines[index]) return;
  line = index;
  tab = 0;
  paintLine();
  renderTabs();
  renderPanel();
  const track = poem.audio?.[trackIndex];
  if (track?.syncLines && reader.isPlaying && poem.lines.length) {
    reader.seekRatio((index + 0.02) / poem.lines.length);
  }
}

function writeUrl(): void {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("p", current().id);
  if (gradeFilter !== "all") url.searchParams.set("g", gradeFilter);
  if (line > 0) url.searchParams.set("line", String(line));
  const next = `${url.pathname}${url.search}`;
  if (`${window.location.pathname}${window.location.search}` !== next) {
    history.replaceState(null, "", next);
  }
}

function flashLine(index: number): void {
  const node = lines.querySelector<HTMLElement>(`[data-line="${index}"]`);
  if (!node) return;
  node.classList.remove("flash");
  void node.offsetWidth;
  node.classList.add("flash");
  window.setTimeout(() => node.classList.remove("flash"), 1700);
  if (window.matchMedia("(max-width: 900px)").matches) {
    node.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function goTo(index: number, nextLine: number, options?: { flash?: boolean; scroll?: boolean; keepLabel?: string }): void {
  const changed = index !== poemIndex;
  poemIndex = Math.min(Math.max(index, 0), poems.length - 1);
  const poem = current();
  line = Math.min(Math.max(nextLine, 0), poem.lines.length - 1);
  tab = 0;
  stamp.classList.remove("on");
  if (changed) {
    const kept = options?.keepLabel
      ? (poem.audio?.findIndex((item) => item.label === options.keepLabel) ?? -1)
      : -1;
    trackIndex = kept >= 0 ? kept : 0;
    exitQuiet();
    showImage(poem);
    loadTrack();
  }
  renderStage();
  renderGallery();
  writeUrl();
  if (options?.flash) flashLine(line);
  else if (options?.scroll !== false) window.scrollTo({ top: 0, behavior: "smooth" });
}

function answerFor(poem: Poem, quizId: string): number | null {
  if (quizId === "scene") return poem.sceneQuiz?.answer ?? null;
  const quiz = poem.quizzes?.[Number(quizId)];
  return quiz ? quiz.answer : null;
}

function openModal(html: string, focusSelector?: string): void {
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  sheet.innerHTML = html;
  modal.classList.add("on");
  const focus = focusSelector ? sheet.querySelector<HTMLElement>(focusSelector) : sheet;
  focus?.focus();
}

function closeModal(): void {
  if (!modal.classList.contains("on")) return;
  modal.classList.remove("on");
  sheet.innerHTML = "";
  lastFocus?.focus();
  lastFocus = null;
}

function openPdf(): void {
  const poem = current();
  const base = import.meta.env.BASE_URL || "./";
  const root = base.endsWith("/") ? base : `${base}/`;
  const sheet = poem.sheet ?? "";
  const page = sheet
    ? `<li><a href="${escapeHtml(`${root}api/pdf/page.jpg?name=${encodeURIComponent(sheet)}`)}">《${escapeHtml(poem.title)}》单页 · A4 图文稿</a></li>`
    : "";
  openModal(
    `<p class="sheet-kicker">打印稿</p>
     <h3>免费下载打印版 PDF</h3>
     <p>一整本 75 首，A4，带拼音和译文，适合打印。点开就能下载或打印，不用填邮箱。</p>
     <ul class="pdf-links">
       <li><a href="${escapeHtml(`${root}api/pdf/full.pdf`)}">整本 75 首 · PDF（带拼音和译文）</a></li>
       ${page}
     </ul>
     <p class="fine">文件也可以另存到手机或电脑，再拿去打印。</p>
     <button type="button" class="print" data-action="close">好</button>`,
  );
}

function openPrint(): void {
  const checks = poems
    .map((poem) => {
      const checked = poem.id === current().id ? " checked" : "";
      return `<label class="check"><input type="checkbox" name="pick" value="${escapeHtml(poem.id)}"${checked}> ${escapeHtml(poem.title)} · ${escapeHtml(poem.author)}</label>`;
    })
    .join("");
  openModal(
    `<p class="sheet-kicker">打卡单</p>
     <h3>定制 A4 打卡单</h3>
     <form id="print-form">
       <div class="checks">${checks}</div>
       <p class="fine">卷子还不能生成。可以先选想要的样式：</p>
       <div class="radios">
         <label class="check"><input type="radio" name="style" value="描红字帖" checked> 描红字帖</label>
         <label class="check"><input type="radio" name="style" value="背诵闯关单"> 背诵闯关单</label>
         <label class="check"><input type="radio" name="style" value="默写自测卷"> 默写自测卷</label>
       </div>
       <button class="print" type="submit">看打印说明</button>
     </form>`,
  );
}

function submitPrint(): void {
  const picked = [...sheet.querySelectorAll<HTMLInputElement>('input[name="pick"]:checked')].map((input) => input.value);
  const style = sheet.querySelector<HTMLInputElement>('input[name="style"]:checked')?.value ?? "描红字帖";
  const titles = picked
    .map((id) => findPoem(id)?.title)
    .filter((title): title is string => Boolean(title))
    .map((title) => `《${title}》`)
    .join("、");
  openModal(
    `<p class="sheet-kicker">还不能打印</p>
     <h3>打卡单还在排版</h3>
     <p>你想要的是${escapeHtml(style)}，篇目是 ${escapeHtml(titles || "还没有选择")}。这一版不会生成卷子，也不会弹出打印窗口。</p>
     <div class="sheet-actions">
       <button type="button" class="print" data-action="pdf">改为下载当前这首的 PDF</button>
       <button type="button" class="textbtn" data-action="close">关闭</button>
     </div>`,
  );
}

function openSoon(id: string): void {
  const poem = findSoon(id);
  if (!poem) return;
  const note = poem.note ? `<span class="sheet-note">${escapeHtml(poem.note)}</span>` : "";
  const first = poem.firstLine ? `<p class="sheet-line">${escapeHtml(poem.firstLine)}</p>` : "";
  openModal(
    `<p class="sheet-kicker">还在整理</p>
     <h3>${escapeHtml(poem.title)} ${note}</h3>
     <p class="sheet-by">${escapeHtml(poem.dynasty)} · ${escapeHtml(poem.author)}</p>
     ${first}
     <p>这里只有篇名和首句。全文、拼音、画卷和朗读还没放上来。</p>
     <div class="sheet-actions">
       <button type="button" class="print" data-action="read" data-id="jiangnan">先听已录好的《江南》</button>
       <button type="button" class="textbtn" data-action="close">知道了</button>
     </div>`,
  );
}

function hideResults(): void {
  dd.classList.remove("on");
  dd.innerHTML = "";
  queryInput.setAttribute("aria-expanded", "false");
  queryInput.removeAttribute("aria-activedescendant");
  readyHits = [];
  soonHits = [];
}

function closeSearch(): void {
  hideResults();
  srch.classList.remove("open");
}

function paintSel(): void {
  dd.querySelectorAll<HTMLElement>("[data-row]").forEach((row) => {
    const on = Number(row.dataset.row) === sel;
    row.classList.toggle("sel", on);
    row.setAttribute("aria-selected", on ? "true" : "false");
  });
  const active = document.getElementById(`opt-${sel}`);
  if (!active) return;
  queryInput.setAttribute("aria-activedescendant", active.id);
  const top = active.offsetTop;
  const bottom = top + active.offsetHeight;
  if (top < dd.scrollTop) dd.scrollTop = top;
  else if (bottom > dd.scrollTop + dd.clientHeight) dd.scrollTop = bottom - dd.clientHeight;
}

function readyThumb(poem: Poem): string {
  if (poem.image) return `<img src="${asset(poem.image)}" alt="">`;
  const label = [...poem.title].slice(0, 2).join("");
  return `<div class="ph" style="background:${escapeHtml(poem.pageColor)}">${escapeHtml(label)}</div>`;
}

function readyRow(hit: ReadyHit, index: number): string {
  const poem = findPoem(hit.poemId);
  if (!poem) return "";
  const text = poem.lines[hit.lineIndex]?.text ?? "";
  const on = index === sel;
  return `<div class="rs${on ? " sel" : ""}" id="opt-${index}" role="option" data-row="${index}" aria-selected="${on ? "true" : "false"}">${readyThumb(poem)}<div><b>${mark(poem.title, hit.titleSpan)}</b><small>${mark(poem.dynasty, hit.dynastySpan)} · ${mark(poem.author, hit.authorSpan)}</small><div class="ml">${mark(text, hit.lineSpan)}</div></div></div>`;
}

function soonRow(hit: SoonHit, index: number): string {
  const poem = findSoon(hit.poemId);
  if (!poem) return "";
  const on = index === sel;
  const note = poem.note ? `<small>${escapeHtml(poem.note)}</small>` : "";
  const alias = hit.alias ? `<div class="ml">也叫「${escapeHtml(hit.alias)}」</div>` : "";
  const first = poem.firstLine ? `<div class="ml">${mark(poem.firstLine, hit.lineSpan)}</div>` : "";
  return `<div class="rs soon${on ? " sel" : ""}" id="opt-${index}" role="option" data-row="${index}" aria-selected="${on ? "true" : "false"}"><div class="ph" aria-hidden="true">诗</div><div><b>${mark(poem.title, hit.titleSpan)}</b><small>${mark(poem.dynasty, hit.dynastySpan)} · ${mark(poem.author, hit.authorSpan)}</small>${note}<span class="soonb">即将上线</span>${alias}${first}</div></div>`;
}

function emptyHtml(text: string): string {
  return `<div class="empty">没有找到「${escapeHtml(text)}」<br>眼下精读 ${poems.length} 首，其余还在整理。<div class="empty-try">试试 <button type="button" data-try="jn">jn</button><button type="button" data-try="床前明月光">床前明月光</button><button type="button" data-try="李白">李白</button></div></div>`;
}

function runSearch(): void {
  const normalized = normalizeQuery(queryInput.value);
  if (!normalized) {
    hideResults();
    return;
  }
  const found = search(queryInput.value, poems, soonPoems);
  readyHits = found.ready;
  soonHits = found.soon;
  sel = 0;
  if (!found.ready.length && !found.soon.length) {
    dd.innerHTML = emptyHtml(normalized);
    dd.classList.add("on");
    queryInput.setAttribute("aria-expanded", "true");
    return;
  }
  let html = "";
  if (found.ready.length) {
    const more = found.readyMore ? `，还有 ${found.readyMore} 首` : "";
    html += `<div class="ddh">找到 ${found.ready.length} 首${more}</div>`;
    html += found.ready.map((hit, index) => readyRow(hit, index)).join("");
  }
  if (found.soon.length) {
    html += `<div class="ddh">即将上线</div>`;
    html += found.soon.map((hit, index) => soonRow(hit, found.ready.length + index)).join("");
  }
  if (found.soonMore) html += `<div class="ddh">还有 ${found.soonMore} 首没列出来，把词写长一点</div>`;
  dd.innerHTML = html;
  dd.classList.add("on");
  queryInput.setAttribute("aria-expanded", "true");
}

function activate(index: number): void {
  if (index < readyHits.length) {
    const hit = readyHits[index];
    if (!hit) return;
    const next = poems.findIndex((poem) => poem.id === hit.poemId);
    closeSearch();
    queryInput.blur();
    if (next >= 0) {
      const poem = poems[next];
      if (poem && gradeFilter !== "all" && poem.grade !== gradeFilter) {
        gradeFilter = "all";
        paintGrades();
      }
      goTo(next, hit.lineIndex, { flash: true });
    }
    return;
  }
  const hit = soonHits[index - readyHits.length];
  if (!hit) return;
  hideResults();
  openSoon(hit.poemId);
}

function openSearch(): void {
  srch.classList.add("open");
  queryInput.focus();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function readInitial(): { pdf: boolean; query: string | null; flash: boolean; grade: GradeFilter } {
  const params = new URLSearchParams(window.location.search);
  const requestedGrade = params.get("g");
  const grade = isGradeFilter(requestedGrade) ? requestedGrade : "all";
  const requested = params.get("p");
  if (requested) {
    const byId = poems.findIndex((poem) => poem.id === requested || poem.title === requested);
    if (byId >= 0) poemIndex = byId;
    else if (/^\d+$/.test(requested)) {
      const numeric = Number(requested);
      if (numeric >= 0 && numeric < poems.length) poemIndex = numeric;
    }
  }
  const lineParam = params.get("line");
  if (lineParam && /^\d+$/.test(lineParam)) {
    const numeric = Number(lineParam);
    if (numeric >= 0 && numeric < current().lines.length) line = numeric;
  }
  const tabParam = params.get("tab");
  if (tabParam && /^\d+$/.test(tabParam)) {
    const numeric = Number(tabParam);
    if (numeric >= 0 && numeric < tabsFor(current()).length) tab = numeric;
  }
  return { pdf: params.get("modal") === "pdf", query: params.get("q"), flash: line > 0, grade };
}

function bind(): void {
  playBtn.addEventListener("click", () => {
    if (!current().audio?.length) {
      paintTrackName("朗读还在录制");
      tname.classList.add("warn");
      window.setTimeout(() => tname.classList.remove("warn"), 1200);
      return;
    }
    void reader.toggle();
  });
  seek.addEventListener("click", (event) => {
    if (!current().audio?.[trackIndex]) return;
    const rect = seek.getBoundingClientRect();
    if (!rect.width) return;
    reader.seekRatio((event.clientX - rect.left) / rect.width);
  });
  mode.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-track]");
    if (!button) return;
    if (button.dataset.track === "quiet") {
      enterQuiet();
      return;
    }
    const next = Number(button.dataset.track);
    if (!Number.isInteger(next) || next === trackIndex) return;
    trackIndex = next;
    exitQuiet();
    loadTrack();
    renderModes();
    paintTrackName();
  });
  $<HTMLButtonElement>("quiet-exit").addEventListener("click", exitQuiet);
  lines.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-line]");
    if (!button) return;
    pickLine(Number(button.dataset.line));
  });
  hots.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-line]");
    if (!button) return;
    pickLine(Number(button.dataset.line));
  });
  tabs.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-tab]");
    if (!button) return;
    tab = Number(button.dataset.tab);
    renderTabs();
    renderPanel();
  });
  panel.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-choice]");
    if (!button) return;
    const quizId = button.dataset.quiz ?? "";
    const choice = Number(button.dataset.choice);
    const answer = answerFor(current(), quizId);
    if (answer === null) return;
    if (choice === answer) {
      button.classList.add("is-right");
      stamp.classList.add("on");
    } else {
      button.classList.add("is-wrong");
    }
  });
  pyBtn.addEventListener("click", () => {
    pinyinOn = !pinyinOn;
    pyBtn.textContent = pinyinOn ? "隐藏拼音自测" : "显示拼音";
    lines.classList.toggle("nopy", !pinyinOn);
  });
  cards.addEventListener("click", (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-poem]");
    if (!card) return;
    goTo(Number(card.dataset.poem), 0);
  });
  soonRoot.addEventListener("click", (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLElement>("[data-soon]");
    if (!chip?.dataset.soon) return;
    openSoon(chip.dataset.soon);
  });
  $<HTMLButtonElement>("print-open").addEventListener("click", openPrint);
  $<HTMLButtonElement>("pdf-open").addEventListener("click", openPdf);
  $<HTMLButtonElement>("home").addEventListener("click", () => {
    gradeFilter = "all";
    paintGrades();
    goTo(Math.max(0, poems.findIndex((poem) => poem.id === "jingye")), 0);
  });
  gradesNav.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-grade]");
    const next = button?.dataset.grade ?? "";
    if (!isGradeFilter(next) || next === gradeFilter) return;
    setGrade(next);
  });
  autoplayBtn.addEventListener("click", () => {
    autoplayNext = !autoplayNext;
    try {
      localStorage.setItem(AUTOPLAY_KEY, autoplayNext ? "1" : "0");
    } catch {
      // Private mode can refuse storage. The toggle still works for this visit.
    }
    paintAutoplay();
  });
  $<HTMLButtonElement>("sico").addEventListener("click", openSearch);
  queryInput.addEventListener("input", runSearch);
  queryInput.addEventListener("focus", runSearch);
  queryInput.addEventListener("keydown", (event) => {
    const total = readyHits.length + soonHits.length;
    if (event.key === "ArrowDown" && total) {
      sel = (sel + 1) % total;
      paintSel();
      event.preventDefault();
    } else if (event.key === "ArrowUp" && total) {
      sel = (sel - 1 + total) % total;
      paintSel();
      event.preventDefault();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (total) activate(sel);
    } else if (event.key === "Escape") {
      closeSearch();
      queryInput.blur();
    }
  });
  dd.addEventListener("mousedown", (event) => {
    const tryButton = (event.target as HTMLElement).closest<HTMLElement>("[data-try]");
    if (tryButton) {
      event.preventDefault();
      queryInput.value = tryButton.dataset.try ?? "";
      runSearch();
      queryInput.focus();
      return;
    }
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-row]");
    if (!row) return;
    event.preventDefault();
    activate(Number(row.dataset.row));
  });
  dd.addEventListener("mousemove", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-row]");
    if (!row) return;
    const next = Number(row.dataset.row);
    if (next === sel) return;
    sel = next;
    paintSel();
  });
  document.addEventListener("click", (event) => {
    if (!srch.contains(event.target as Node)) closeSearch();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("on")) {
      closeModal();
      return;
    }
    if (event.key === "/" && !isTypingTarget(event.target) && !modal.classList.contains("on")) {
      event.preventDefault();
      openSearch();
    }
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  sheet.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "close") closeModal();
    if (action === "pdf") {
      closeModal();
      openPdf();
    }
    if (action === "read") {
      const id = button.dataset.id ?? "jiangnan";
      closeModal();
      const index = poems.findIndex((poem) => poem.id === id);
      if (index >= 0) goTo(index, 0);
    }
  });
  sheet.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (form.id === "print-form") submitPrint();
  });
}

function boot(): void {
  if (!poems.length) {
    $<HTMLElement>("paper").insertAdjacentHTML("afterbegin", `<p class="pending">诗库没有载入。</p>`);
    return;
  }
  const initial = readInitial();
  gradeFilter = initial.grade;
  if (gradeFilter !== "all" && current().grade !== gradeFilter) gradeFilter = "all";
  paintGrades();
  paintAutoplay();
  renderLeads();
  renderSoonList();
  showImage(current());
  loadTrack();
  renderStage();
  renderGallery();
  if (initial.flash) {
    window.setTimeout(() => flashLine(line), 60);
  }
  if (initial.query) {
    queryInput.value = initial.query;
    srch.classList.add("open");
    runSearch();
  }
  if (initial.pdf) openPdf();
  writeUrl();
  startEffects($<HTMLCanvasElement>("fx"), () => current().effect);
  bind();
}

boot();
