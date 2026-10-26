# 必背诗笺

免费的小学生必背古诗词读本。横排、一句一行、拼音。图文版里的诗已经能读全文，每首都有一幅诗意画。《静夜思》《春晓》《山行》《江南》仍用原来的画，《江南》的三条录音仍是本地文件。

A free reader for the classical poems Chinese primary students memorize. Horizontal lines, one sentence each, with pinyin. Every readable poem has a scene painting. 《静夜思》《春晓》《山行》《江南》 keep their original paintings, and 《江南》keeps its three local recordings.

## 素材 / Assets

`assets/` 目录存放整理用的原始素材：75 首古诗的图像版（79 张 JPG）、PDF 版（76 页）、10 个版本的朗读音频和 34 个跟读视频。

- 图片、PDF、文档体积小（约 58 MB），直接提交在 [assets/](assets/)，一首一页，可打印。
- 音频（980 MB）、视频（1.64 GB）和 257 MB 的 Word 合集超出 GitHub 单文件 100 MB 的限制，放在 [Releases](https://github.com/xiaowen-pm/Ancient-Chinese-Poems-for-Primary-School/releases) 下载。本轮**不把音频推进仓库**，也**不做视频播放**。音频只保留《江南》已有的三条例子，其余版本下轮再接。
- 站点读的是 `src/data/poems.json` 里的正文。图文 JPG 不打进 `dist/`：新诗的「看图文打印稿」链接到 [raw.githubusercontent.com](https://raw.githubusercontent.com/xiaowen-pm/Ancient-Chinese-Poems-for-Primary-School/main/assets/01-%E5%9B%BE%E6%96%87%E7%89%88/%E5%9B%BE%E7%89%87%E7%89%88-%E5%B8%A6%E6%B3%A8%E9%9F%B3%2B%E8%AF%91%E6%96%87/) 上的原文件，避免 Cloudflare Pages 把约 40 MB 的 JPG 再打包一遍。本地素材仍在 `assets/01-图文版/图片版-带注音+译文/`。
- 清单、体积和版权说明见 [assets/README.md](assets/README.md)。

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
| 图文版覆盖的诗：原文、对齐的拼音、逐句画境、白话译文 | 真。正文、拼音、译文对照 `assets/` 里的图文页核对；画境和译文改写成儿童读法，不整段抄页面 |
| 《静夜思》《春晓》《山行》的画卷、热点、诗人小剧场、看画猜诗 | 真，保持原样 |
| 《江南》画卷、注释、译文、赏析、小测、三条录音 | 真，保持原样。录音在 `public/audio/` |
| 《江南》跟读时的逐句高亮 | 真，但按整段时长平均切开，还不是逐句打点 |
| 新诗的注释、赏析 | 真。75 首按公开网页改写成儿童读法，页脚写明出处。背景和小测仍是「还在整理」 |
| 新诗的诗意画 | 真。75 幅水墨设色画卷在 `public/images/`，约 1040×780 的 webp，原来的四幅没有换 |
| 新诗的朗读 | 真，从 GitHub Release 的压缩包里按需取出，不打进 `dist/`。能对上几条就放几条 |
| 新诗的图文打印稿 | 真的链接，打开仓库里的 JPG，不进构建产物 |
| 搜索（诗名、作者、朝代、诗句、拼音、声母、别名） | 真。图文版没有的拓展篇目仍只有篇名和首句，点开写明「即将上线」 |
| 邮箱领取可打印 PDF | 真。`POST /api/pdf-request` 校验邮箱，记到 Cloudflare KV（绑定名 `SIGNUPS`），并用 Resend 寄下载链接。没配 `RESEND_API_KEY`，或发件人还是 `pdf@example.com` 时，不发信，页面上直接给出链接。PDF 仍在仓库的 `assets/`，不打进 `dist/` |
| 打卡单打印 | 演示。不会生成卷子，也不会弹出打印 |
| 视频 | 不做 |
| Releases 里的朗读音频 | 不提交 MP3。站点用同一来源的 `/audio-pack` 读压缩包里的一首 |

《江南》和后来补上的 75 首，注释、译文、赏析都是根据公开网页改写的儿童读法，页脚有出处。新诗还注明对照了哪一张图文稿。没有把教材或网站原文整段搬过来。出处用的是能打开诗文的百度汉语详情页。古诗文网的检索现在会跳到登录，旧的 `view_` 链接会跳到下载 App，所以没有拿那些地址当出处。

朗读来自 Release `assets-audio` 的 10 个 zip（大约 1153 条 MP3），索引在 `src/data/audio-index.json`。压缩包里的 MP3 是「存储」方式，字节连在一起。GitHub 的下载地址会跳到一份没有 CORS 的短时链接，而且不接受 `bytes=-N` 这种从末尾倒数的范围请求，浏览器不能自己把某一首切出来。`/audio-pack.mp3?zip=audio-05.zip&file=…` 在同源上用明确的 `bytes=开始-结束` 读出那一首，按 `audio/mpeg` 返回。路径以 `.mp3` 结尾，手机浏览器才会把它当成音频。浏览器若请求整首（`bytes=0-`），一次只返回约 512KB，剩下的由播放器接着要。整段都能放进这一窗时，回答 200 而不是「整首文件的 206」，否则 Safari 会拒绝播放。开发服务器和 `npm run preview` 走 Vite 中间件；线上要靠 `wrangler.jsonc` 里的 Worker（`run_worker_first`）先处理这个地址，其余页面仍用 `dist/`。如果部署只上传 `dist/`、不跑这个 Worker，朗读地址会 404，页面其余部分不受影响。

多数诗有五条：童声跟读、跟读、朗读、朗读解析、朗读赏析。跟读两条会按整段时长平均跳句，还不是逐句打点。《江畔独步寻花》站内正文是「黄四娘家花满蹊」，只接了写明其六或听写对得上的录音；不少压缩包里的「江畔独步寻花」其实是「黄师塔前」，没有接上。《相思》《乐游原》《竹里馆》《鸟鸣涧》不在每一包的 75 首里，所以版本少一些。

两张《悯农》的文件名和页眉编号对不上：名为「其一」的那张印的是「锄禾日当午」，名为「其二」的那张页眉写着「其一」、正文是「春种一粒粟」。站内按页上的文字编号，打印链接指向真正印着那首诗的 JPG。

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

还没有诗意画时，可以不写 `image`。若仓库里有对应的图文 JPG，把文件名写进 `sheet`（只写 `图片版-带注音+译文/` 下的文件名）。页面会链到 GitHub 上的原图，构建时不会把它复制进 `dist/`。

图片放 `public/images/`，录音放 `public/audio/`。改完跑 `npm run check`。若某个字变成了另一种字体，再跑一次 `python3 scripts/subset-font.py`（需要本机有 Noto Serif SC 可变字体，脚本里写的是 `/tmp/NotoSerifSC-vf.ttf`）。

## 部署 / Deploy

构建产物在 `dist/`，资源用相对路径，放在域名根目录或 GitHub Pages 的子路径都可以。

```bash
npm run build
```

- **Netlify**：仓库里有 `netlify.toml`，发布目录是 `dist`。
- **Vercel**：有 `vercel.json`，框架选 Vite 即可。
- **Cloudflare Workers**：仓库里有 `wrangler.jsonc`。Worker 先回答 `/api/pdf-request` 和 `/audio-pack`，其余请求交给 `dist/`。`name` 与现在的 workers.dev 子域一致。非生产分支的 `npx wrangler preview` 需要文件里的 `previews` 块；预览不继承变量和 KV，所以领取 PDF 的绑定在顶层和 `previews` 里各写一次。资源和 Worker 名仍只写在顶层。
- **GitHub Pages**：把 `dist/` 里的文件作为站点根目录发布。不要把整个仓库根目录当站点，那里没有构建后的脚本。Pages 上没有这个 Worker，朗读地址不可用。

本地先看构建结果：`npm run preview`。

## 邮箱领取 PDF / Printable PDF

诗页上的「免费领取可打印 PDF」把家长邮箱交给同源的 `POST /api/pdf-request`。Worker 校验邮箱，用隐藏字段和按 IP 的次数限制挡住简单的灌水，再把邮箱、时间和来源（`web` 或 `web:诗的 id`）写进 KV 绑定 `SIGNUPS`。同一个邮箱只保留一条，后一次会更新时间。邮件里只有下载链接：整本 `assets/01-图文版/PDF版-带注音+译文/02必背古诗词75首-PDF版.pdf`，以及这一首的单页 JPG（如果有）。文件不进邮件，也不进 `dist/`。

发信走 Resend 的 HTTP API。密钥是 `RESEND_API_KEY`，发件人是 `RESEND_FROM`。发件人仍是 `pdf@example.com`，或还没有密钥时，不发信，页面直接显示链接。本地 `npm run dev` / `npm run preview` 用内存名册，重启就没了。只上传 `dist/`、不跑 Worker 时，这个接口不存在。

打卡单仍然是说明，不会生成卷子。

## 下一步 / Next

- 图文版里能对上的诗，正文已经在 `poems.json`。`soon.json` 只留图文页没有的拓展篇目，不是官方全表。
- 新诗的注释、赏析和能对上的朗读已经接上。背景、小测、诗意画还没有。
- 给《江南》和跟读两条补上真实的逐句时间点。仍然不要把整包音频提交进仓库。
- 线上朗读依赖 Worker。只发布 `dist/` 时，`/audio-pack` 不会出现。
- 继续不做视频。
