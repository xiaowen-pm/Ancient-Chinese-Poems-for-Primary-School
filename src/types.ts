/** A line of a poem. Pinyin tokens line up with every character, including punctuation. */
export type PoemLine = {
  text: string;
  pinyin: string;
  /** A phrase inside `text` to underline. */
  key?: string;
  /** 示意：这一句的白话画境。可用 **强调**。 */
  gloss: string;
  /** 解析：这一句的注释。 */
  note?: string;
};

export type Hotspot = {
  x: number;
  y: number;
  label: string;
  line: number;
};

export type Quiz = {
  question: string;
  options: string[];
  answer: number;
};

export type AudioTrack = {
  label: string;
  /** Path under the site base, e.g. `audio/jiangnan.mp3`. */
  src: string;
  /** Highlight lines while this track plays. 解析 / 赏析 stay on the current line. */
  syncLines?: boolean;
  /**
   * Optional start time in seconds for each line, same length as `lines`.
   * When omitted, 跟读 divides the track into equal slices.
   */
  cues?: number[];
};

export type SourceNote = {
  name: string;
  url: string;
  used: string;
};

export type EffectName = "glow" | "petal" | "leaf" | "ripple";

/**
 * One readable poem.
 * Panels:
 * - 示意 `lines[].gloss`，简单三首显示为「逐句画境」
 * - 解析 `lines[].note` / `translation` / `background`
 * - 讲解 `appreciation` / `story`
 * - 小测 `quizzes`（江南）或 `sceneQuiz`（看画猜诗）
 * Leave a field out and the panel shows an honest empty state.
 */
export type Poem = {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  titlePinyin: string;
  authorPinyin: string;
  dynastyPinyin: string;
  tag: string;
  pageColor: string;
  effect: EffectName;
  /** Illustrated scene under `public/`. Omitted until a painting is ready. */
  image?: string;
  /**
   * Filename in `assets/01-图文版/图片版-带注音+译文/`.
   * The site links to it on GitHub; the JPG is not copied into the build.
   */
  sheet?: string;
  /** Extra titles a reader might type, such as 渭城曲 or 锄禾. */
  aliases?: string[];
  lines: PoemLine[];
  hotspots: Hotspot[];
  story?: string;
  sceneQuiz?: Quiz;
  translation?: string;
  appreciation?: string[];
  background?: string;
  quizzes?: Quiz[];
  audio?: AudioTrack[];
  sources?: SourceNote[];
};

/** A catalog entry that can be searched, but has no full text or picture yet. */
export type SoonPoem = {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  titlePinyin: string;
  authorPinyin: string;
  dynastyPinyin: string;
  aliases?: string[];
  /** First line only, so a remembered sentence can still be found. Not the whole poem. */
  firstLine?: string;
  note?: string;
};
