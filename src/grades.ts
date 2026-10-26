/**
 * 册次按部编版（人教）小学语文。
 * 对照 https://www.gushiwenku.cn/xuanji/xiaoxue-gushi/
 * 一年级上下册又对照了 https://www.ixuehai.cn/html/4488.html
 * 课本里没有的篇目记为 extra（课外 / 拓展）。
 */

export const GRADE_CHIPS = [
  { id: "all", label: "全部" },
  { id: "1-1", label: "一年级上" },
  { id: "1-2", label: "一年级下" },
  { id: "2-1", label: "二年级上" },
  { id: "2-2", label: "二年级下" },
  { id: "3-1", label: "三年级上" },
  { id: "3-2", label: "三年级下" },
  { id: "4-1", label: "四年级上" },
  { id: "4-2", label: "四年级下" },
  { id: "5-1", label: "五年级上" },
  { id: "5-2", label: "五年级下" },
  { id: "6-1", label: "六年级上" },
  { id: "6-2", label: "六年级下" },
  { id: "extra", label: "课外" },
] as const;

export type GradeFilter = (typeof GRADE_CHIPS)[number]["id"];

export type GradeId = Exclude<GradeFilter, "all">;

/** Textbook order inside each册. `extra` keeps the order of poems.json. */
export const TEXTBOOK_ORDER: Record<Exclude<GradeId, "extra">, readonly string[]> = {
  "1-1": ["yong-e", "jiangnan", "min-nong-2", "gulang", "feng"],
  "1-2": ["chunxiao", "zeng-wang-lun", "jingye", "xun-yin", "chi-shang", "xiaochi"],
  "2-1": ["xiaoer", "deng-guanquelou", "wang-lushan", "jiangxue", "chi-le-ge"],
  "2-2": ["cunju", "yong-liu", "fude", "xiaochu", "jueju-huangli", "min-nong-1"],
  "3-1": ["suojian", "shanxing", "wang-tianmenshan", "yinhu", "wang-dongting", "zaofa"],
  "3-2": ["jueju-chiri", "huichong", "sanqu", "yijiangnan", "yuanri", "qingming", "jiuyue", "chuzhou"],
  "4-1": ["luchai", "tixilin", "chusai", "liangzhou-wanghan", "xiari", "biedongda"],
  "4-2": ["sishi-2", "feng-luoyin", "furonglou", "saixiaqu", "momei"],
  "5-1": ["shier", "tilinan", "jihai", "fengqiao", "yugezi", "guan-shu"],
  "5-2": ["sishi-1", "niaomingjian", "song-yuaner", "qiuye", "liangzhou-wangzhihuan", "huanghelou-song", "xiangcun"],
  "6-1": ["wanghulou", "chunri", "hui-xiang", "langtaosha", "jiangnan-chun", "shuhu"],
  "6-2": ["chang-ge-xing", "shihui", "zhushi", "chunye-xiyu", "zaochun", "jiangshang", "bochuan", "youyuan"],
};

export function isGradeFilter(value: string | null): value is GradeFilter {
  return GRADE_CHIPS.some((chip) => chip.id === value);
}

export function gradeLabel(id: GradeFilter): string {
  return GRADE_CHIPS.find((chip) => chip.id === id)?.label ?? "全部";
}

/** Next poem in the filtered list that has the same audio label. */
export function nextAutoplayId(
  visible: readonly { id: string; labels: readonly string[] }[],
  currentId: string,
  label: string,
): string | null {
  const start = visible.findIndex((item) => item.id === currentId);
  if (start < 0) return null;
  for (let index = start + 1; index < visible.length; index += 1) {
    const item = visible[index];
    if (item && item.labels.includes(label)) return item.id;
  }
  return null;
}
