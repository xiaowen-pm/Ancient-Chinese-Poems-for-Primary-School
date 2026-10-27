# 必背诗笺

**小学生必背古诗词的免费在线读本。** 每一句都有拼音、有画境，一首诗配一幅水墨诗意图；能听童声跟读和朗读解析，也能一键下载打印版 PDF。

在线使用 → **https://ancient-chinese-poems-for-primary-school.iamgengxiaowen.workers.dev/?p=jingye**

![必背诗笺：左边是《静夜思》的诗意图，右边是带拼音的正文、注释和朗读](docs/preview.jpg)

A free web reader for the classical poems Chinese primary students memorize — pinyin on every line, a child-friendly paraphrase, a scene painting for each poem, read-aloud audio, and a printable PDF.

## 这是什么

给小学生和家长用的古诗词读本站。课本要求背的诗，在这里一句一行、拼音对字、配一幅画和一句白话解释；不想读的时候可以听，听完可以打印出来贴在书桌前。

- **79 首**可以读全文，按部编版小学语文上下册分好年级；另有一组课外拓展篇目（还有 21 首只有篇名和首句，正在补）
- **75 幅**水墨设色诗意图，每首一幅
- **10 个版本、1153 条**朗读录音，按需从 Release 的压缩包里取出，不进构建产物
- 纯静态站点：没有登录、没有广告、不收集个人信息

## 能做什么

**读**

- 逐句拼音，和每个字对齐，可以「隐藏拼音自测」
- 逐句画境：每句一条白话解释
- 注释、译文、赏析、诗人小剧场
- 诗意图上带热点，点一下跳到对应的句子
- 「看画猜诗」小测

**听**

- 每首最多五条：童声跟读、跟读、朗读、朗读解析、朗读赏析
- 跟读时逐句高亮，可以连播下一首
- 手机上也能播：音频按字节范围从 GitHub Release 的压缩包里读出来

**找**

- 搜诗名、作者、朝代、诗句、拼音、声母、别名（输入 `jn` 也能找到《江南》）
- 按年级筛选，搜索里也能看到「即将上线」的篇目

**打印**

- 整本 75 首的 PDF，带拼音和译文
- 当前这一首的单页 A4 图文稿
- 打卡单还在做，现在只是选样式的说明

## 本地运行

需要 Node.js 22 或更新。不要直接双击打开 `index.html`，朗读和模块脚本需要一个本地服务器。

```bash
npm install
npm run dev
```

浏览器打开 [http://127.0.0.1:4731](http://127.0.0.1:4731)。

```bash
npm run check    # 校对诗句拼音是否对齐，并跑搜索和下载接口的测试
npm run build    # 生成 dist/
npm run preview  # 预览 dist/，同样是 4731 端口
```

地址可以带参数：`?p=jiangnan` 打开《江南》，`?p=0` 仍是《静夜思》（和旧原型的序号一样），`?q=jn` 打开搜索，`?modal=pdf` 打开下载打印稿的窗口。

## 目录结构

```
index.html              页面骨架
src/
  main.ts               渲染、交互、URL 参数
  data/poems.json       79 首的正文、拼音、注释、赏析
  data/soon.json        还只有篇名的拓展篇目
  data/audio-index.json 1153 条录音的索引
  releaseAudio.ts       从 Release 压缩包里按范围读出一首
  pdfSignup.ts          下载接口；邮箱领取的代码保留，页面未启用
  resend.ts             Resend 发信封装
  style.css             样式
worker/index.ts         Cloudflare Worker：下载、朗读、静态站点
scripts/                拼音对齐检查、字体子集化
public/images/          79 幅诗意图
public/audio/           《江南》的三条本地录音
docs/preview.jpg        README 用的截图
assets/                 整理用的原始素材（图文 JPG、整本 PDF、文档）
```

## 素材 / Assets

`assets/` 存放整理用的原始素材：75 首古诗的图像版（79 张 JPG）、PDF 版（76 页）、10 个版本的朗读音频和 34 个跟读视频。

- 图片、PDF、文档体积小（约 58 MB），直接提交在 [assets/](assets/)，一首一页，可打印。
- 音频（约 1.0 GB）、视频（约 1.7 GB）和 257 MB 的 Word 合集超出 GitHub 单文件 100 MB 的限制，放在 [Releases](https://github.com/xiaowen-pm/Ancient-Chinese-Poems-for-Primary-School/releases) 下载。音频**不推进仓库**，也**不做视频播放**：《江南》的三条例子在 `public/audio/`，其余从 Release 里按需读。
- 站点读的是 `src/data/poems.json` 里的正文。图文 JPG 不打进 `dist/`：新诗的「看图文打印稿」链接到 [raw.githubusercontent.com](https://raw.githubusercontent.com/xiaowen-pm/Ancient-Chinese-Poems-for-Primary-School/main/assets/01-%E5%9B%BE%E6%96%87%E7%89%88/%E5%9B%BE%E7%89%87%E7%89%88-%E5%B8%A6%E6%B3%A8%E9%9F%B3%2B%E8%AF%91%E6%96%87/) 上的原文件，避免把约 40 MB 的 JPG 再打包一遍。
- 清单、体积和版权说明见 [assets/README.md](assets/README.md)。

## 哪些是真的 / What is real

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
| 下载可打印 PDF | 真。诗页按钮直接给出下载链接：整本 75 首 PDF，和这一首的单页图文稿。文件在仓库 `assets/`，经本站 `/api/pdf/…` 转发，不打进 `dist/`。邮箱领取先关掉，页面不收集邮箱 |
| 打卡单打印 | 演示。不会生成卷子，也不会弹出打印 |
| 视频 | 不做 |
| Releases 里的朗读音频 | 不提交 MP3。站点用同一来源的 `/audio-pack` 读压缩包里的一首 |

《江南》和后来补上的 75 首，注释、译文、赏析都是根据公开网页改写的儿童读法，页脚有出处。新诗还注明对照了哪一张图文稿。没有把教材或网站原文整段搬过来。出处用的是能打开诗文的百度汉语详情页。古诗文网的检索现在会跳到登录，旧的 `view_` 链接会跳到下载 App，所以没有拿那些地址当出处。

朗读来自 Release `assets-audio` 的 10 个 zip（大约 1153 条 MP3），索引在 `src/data/audio-index.json`。压缩包里的 MP3 是「存储」方式，字节连在一起。GitHub 的下载地址会跳到一份没有 CORS 的短时链接，而且不接受 `bytes=-N` 这种从末尾倒数的范围请求，浏览器不能自己把某一首切出来。`/audio-pack.mp3?zip=audio-05.zip&file=…` 在同源上用明确的 `bytes=开始-结束` 读出那一首，按 `audio/mpeg` 返回。路径以 `.mp3` 结尾，手机浏览器才会把它当成音频。浏览器若请求整首（`bytes=0-`），一次只返回约 512KB，剩下的由播放器接着要。整段都能放进这一窗时，回答 200 而不是「整首文件的 206」，否则 Safari 会拒绝播放。开发服务器和 `npm run preview` 走 Vite 中间件；线上由 `wrangler.jsonc` 里的 Worker 处理这个地址，其余页面走静态资源。

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
- **Cloudflare Workers**：仓库里有 `wrangler.jsonc`。`run_worker_first` 只列 `/api/*`、`/audio-pack`、`/audio-pack.mp3`，所以页面、79 张诗意图、字体和下载文件都由 Cloudflare 的静态资源层直出，**不占用 Worker 请求额度**（免费版 10 万次/天）。Worker 只回答下载接口、邮箱接口和朗读地址。`name` 与现在的 workers.dev 子域一致。非生产分支的 `npx wrangler preview` 需要文件里的 `previews` 块；预览不继承 KV，所以 `SIGNUPS` 在顶层和 `previews` 里各写一次。资源和 Worker 名仍只写在顶层。
- **GitHub Pages**：把 `dist/` 里的文件作为站点根目录发布。不要把整个仓库根目录当站点，那里没有构建后的脚本。Pages 上没有这个 Worker，朗读地址不可用。

本地先看构建结果：`npm run preview`。

## 下载 PDF / Printable PDF

诗页上的「免费下载打印版 PDF」直接给出下载链接，同源的 `/api/pdf/…` 由 Worker 转发仓库里的文件：整本 `assets/01-图文版/PDF版-带注音+译文/02必背古诗词75首-PDF版.pdf`，以及这一首的单页 JPG（如果有）。文件不进邮件，也不进 `dist/`，链接不直接依赖 GitHub。

额度与防刷：页面、图片、字体和下载文件都由 Cloudflare 静态资源层直出（`run_worker_first` 只列 `/api/*` 和朗读地址），所以正常浏览不消耗 Worker 请求；下载响应带 `cache-control: public, max-age=3600`，同一文件重复打开会命中缓存。真被刷时，在 Cloudflare 上给绑定的自有域名加 Cache Rules、Rate Limiting、Bot Fight Mode，或给下载地址加短时签名即可。`workers.dev` 子域没有这些开关，绑自己的域名才有。

邮箱领取先关掉：页面不再收集邮箱。原来那套 `POST /api/pdf-request` + Resend + KV `SIGNUPS` 的代码还留在 `src/pdfSignup.ts` 和 `src/resend.ts` 里，`GET /api/mail-status` 也还在，接回来时把表单加回 `openPdf()` 即可。密钥认 `RESEND_API_KEY` 或 `resend`，发件人取 `RESEND_FROM`，没设时自动用 Resend 里第一个已验证域名。本地 `npm run dev` / `npm run preview` 用 `.dev.vars` 或环境变量里的 `RESEND_API_KEY`，名册在内存里，重启就没了。

打卡单仍然是说明，不会生成卷子。

## 下一步 / Next

- 图文版里能对上的诗，正文已经在 `poems.json`。`soon.json` 只留图文页没有的拓展篇目，不是官方全表。
- 新诗的注释、赏析和能对上的朗读已经接上。背景、小测、诗意画还没有。
- 给《江南》和跟读两条补上真实的逐句时间点。仍然不要把整包音频提交进仓库。
- 线上朗读依赖 Worker。只发布 `dist/` 时，`/audio-pack` 不会出现。
- 继续不做视频。
