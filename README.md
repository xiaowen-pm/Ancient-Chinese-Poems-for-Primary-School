# 必背诗笺

免费的小学生必背古诗词读本。横排、一句一行、拼音，配水墨诗意画。目标是把课内 75 首和拓展 80 首都收进来。现在先把《静夜思》《春晓》《山行》《江南》做成能读的一页，《江南》有真正的跟读、解析和赏析录音。

A free reader for the classical poems Chinese primary students memorize. Horizontal lines, pinyin, and illustrated scenes. Four poems are readable today. 《江南》plays real audio. The rest of the 75 + 80 list can be searched by title, but the full text is not in yet.

## 本地运行 / Run locally

需要 Node.js 22 或更新。不要直接双击打开 `index.html`，朗读和模块脚本需要一个本地服务器。

```bash
npm install
npm run dev
```

浏览器打开 [http://127.0.0.1:4731](http://127.0.0.1:4731)。

```bash
npm run check    # 校对诗句拼音是否对齐，并跑搜索测试
npm run build    # 生成 dist/
npm run preview  # 预览 dist/，同样是 4731 端口
```

地址可以带参数：`?p=jiangnan` 打开《江南》，`?p=0` 仍是《静夜思》（和旧原型的序号一样），`?q=jn` 打开搜索，`?modal=pdf` 打开领取打印稿的窗口。

## 现在是真的，现在是演示 / What is real

| | |
| --- | --- |
| 四首诗的原文、拼音、画卷、逐句画境 | 真。文字来自原型，画是原型里的插画 |
| 《江南》跟读 / 朗读解析 / 朗读赏析 | 真。文件在 `public/audio/` |
| 《江南》跟读时的逐句高亮 | 真，但按整段时长平均切开，还不是逐句打点 |
| 搜索（诗名、作者、朝代、诗句、拼音、声母） | 真。另外约几十首只有篇名和首句 |
| 其余正文、注释、朗读、画卷 | 还没有。搜到了会写明「即将上线」 |
| 邮箱领取 PDF、打卡单打印 | 演示。不会发信，不会保存邮箱，也不会弹出打印 |
| 视频 | 不做 |

《江南》的注释、译文、赏析是根据公开网页改写的儿童读法，页脚有出处。没有把教材或网站原文整段搬过来。

## 加一首诗 / Add a poem

可读的诗在 `src/data/poems.json`，不用改页面。拼音要和每个字对齐，标点也占一格：

```json
{
  "id": "yong-e",
  "title": "咏鹅",
  "author": "骆宾王",
  "dynasty": "唐",
  "titlePinyin": "yǒng é",
  "authorPinyin": "luò bīn wáng",
  "dynastyPinyin": "táng",
  "tag": "一年级上",
  "pageColor": "#e7f0e4",
  "effect": "ripple",
  "image": "images/yong-e.webp",
  "lines": [
    {
      "text": "鹅，鹅，鹅，",
      "pinyin": "é ， é ， é ，",
      "key": "鹅",
      "gloss": "诗人一连喊了三声**鹅**。",
      "note": "**鹅**：家禽。"
    }
  ],
  "hotspots": [{ "x": 50, "y": 40, "label": "白鹅", "line": 0 }]
}
```

面板是分开的，缺了就显示「还在整理」：

- 示意：每句的 `gloss`（「逐句画境」）
- 解析：每句的 `note`、整首的 `translation`、`background`
- 讲解：`appreciation`、`story`（诗人小剧场）
- 小测：`quizzes`；看画猜诗用 `sceneQuiz`
- 朗读：`audio`。`syncLines: true` 才会在播放时跳句子。以后可以加 `cues`（每句开始的秒数）

只有篇名、还没有正文的，写在 `src/data/soon.json`。搜索能找到，点开会说明还没做完。

图片放 `public/images/`，录音放 `public/audio/`。改完跑 `npm run check`。若某个字变成了另一种字体，再跑一次 `python3 scripts/subset-font.py`（需要本机有 Noto Serif SC 可变字体，脚本里写的是 `/tmp/NotoSerifSC-vf.ttf`）。

## 部署 / Deploy

构建产物在 `dist/`，资源用相对路径，放在域名根目录或 GitHub Pages 的子路径都可以。

```bash
npm run build
```

- **Netlify**：仓库里有 `netlify.toml`，发布目录是 `dist`。
- **Vercel**：有 `vercel.json`，框架选 Vite 即可。
- **GitHub Pages**：把 `dist/` 里的文件作为站点根目录发布。不要把整个仓库根目录当站点，那里没有构建后的脚本。

本地先看构建结果：`npm run preview`。

## 以后的 PDF 邮件 / Email later

现在的邮箱窗口只在浏览器里确认，不发请求。以后可以保持这个静态站，另加一个很小的接口：

1. `POST /api/pdf-request`，正文 `{ "email": "name@example.com", "poemId": "jiangnan" }`。
2. 校验邮箱，把请求记在数据库或一张表里。
3. PDF 事先做好，放在对象存储。邮件里只放下载链接，不把文件塞进仓库。
4. 用 Resend、Amazon SES 或同类服务发信。
5. 静态页面仍由 Netlify / Vercel / GitHub Pages 托管，只有这个接口是服务器。

没有接上之前，不要把成功提示写成「已经发送」。

## 下一步 / Next

- 把 75 + 80 首的正文补进 `poems.json`。`soon.json` 只是方便检索的起步目录，不是官方全表。
- 注释、译文、赏析从公开网页整理，改写成儿童能读的话，并在 `sources` 里写上出处。
- 给《江南》跟读补上真实的逐句时间点；另外三首的朗读还没录。
- 接上真正的邮件和 PDF。
- 继续不做视频。
