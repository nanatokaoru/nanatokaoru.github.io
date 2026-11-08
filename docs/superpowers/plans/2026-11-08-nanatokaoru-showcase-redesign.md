# 《奈奈与薰》专题站重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有图墙式静态站改成《奈奈与薰的SM日记》专题：首页介绍作品、三篇独立浏览、特别图集保留、横向无缝横带阅读。

**Architecture:** 保留 `src/data/book{1,2,3}-*.json` 与 `public/image/`。新增 `catalog` 数据层统一 `part` 映射与阅读页解析；用 Vue Router 拆成首页 / 篇页 / 图集 / 阅读四类页面；阅读主路径是自研横向 strip（`localStorage` 记方向与双页停靠），`v-viewer` 仅作双击放大。

**Tech Stack:** Vue 3 + Vue Router + Pinia + Vite + TypeScript + Vitest + Playwright + 现有 `v-viewer`

**Spec:** `docs/superpowers/specs/2026-11-08-nanatokaoru-showcase-redesign-design.md`

## Global Constraints

- 不做多部作品通用站、账号、评论、搜索、后端
- 不改动 `public/image` 内图片文件
- 不引入新 UI 组件库
- `part`: `main`=book1，`summer`=book2，`school`=book3
- 阅读默认 RTL；双页默认按一对开停；封面/彩图阅读只用展示图，忽略条目 `pages`
- 「从本篇开始读」→ `/part/main`
- URL 的 `/read` 只带 `part` + `source` + `id`，禁止把 `pages` 数组塞进 query
- 提交：本仓库用户规则是「仅在用户明确要求时 commit」。计划里的 Commit 步在未要求时一律跳过，改动留在工作区

## Review Focus

1. 无效 `part` / `kind` / `id` → 回首页或篇页，不白屏
2. 本篇封面条目带整卷 `pages` 时，图集阅读仍只显示一张展示图
3. 本篇 101/102 话共用封面时列表 key 不重复警告
4. 夏日篇/高校篇章节无 `pages`：能按相邻封面页码切段生成 URL；切不出则单封面 +「暂无完整页」
5. RTL/LTR 与双页停靠方式刷新后仍保持

## File Structure

| 文件 | 职责 |
|------|------|
| `src/types/comic.ts` | `PartId`、`GalleryKind`、`ReadSource`、条目与阅读载荷类型 |
| `src/data/catalog.ts` | part→JSON 映射、数量、查章节/图集、解析阅读页列表 |
| `src/data/work.ts` | 作品级文案（书名、作者、简介、标签） |
| `src/composables/useReaderPrefs.ts` | RTL/LTR、双页停靠的 localStorage |
| `src/assets/base.css` / `main.css` | 清爽浅色 token、字体 |
| `src/router/index.ts` | `/`、`/part/:part`、`/part/:part/gallery/:kind`、`/read` |
| `src/views/HomeView.vue` | 专题首页 |
| `src/views/PartView.vue` | 篇页（特别展示 + 章节） |
| `src/views/GalleryView.vue` | 图集页 |
| `src/views/ReadView.vue` | 阅读页壳：解析 query → 横带 |
| `src/components/reader/StripReader.vue` | 横向无缝横带 |
| `src/components/PartCard.vue` | 首页篇卡片 |
| `src/components/ChapterCard.vue` | 章节卡片（key=`part-num`） |
| `src/components/GalleryCard.vue` | 单图/双页卡片 |
| 删除或停用 | `WikiView.vue`、旧 `ComicDetailView`/`ChapterDetail` 硬编码路径、模板欢迎组件（任务末清理） |

---

### Task 1: 类型与 catalog 数据层

**Files:**
- Create: `src/types/comic.ts`
- Create: `src/data/catalog.ts`
- Create: `src/data/work.ts`
- Create: `src/data/__tests__/catalog.spec.ts`

**Interfaces:**
- Produces:
  - `type PartId = 'main' | 'summer' | 'school'`
  - `type GalleryKind = 'covers' | 'pictures' | 'dual'`
  - `type ReadSource = 'chapter' | GalleryKind`
  - `getPartMeta(part: PartId): { id: PartId; label: string; counts: { chapters: number; covers: number; pictures: number; dual: number }; coverUrl: string }`
  - `listParts(): ReturnType<typeof getPartMeta>[]`
  - `listChapters(part: PartId): { num: number; chapterName?: string; leftImageUrl: string }[]`
  - `listGallery(part: PartId, kind: GalleryKind): { index: number; leftImageUrl: string; rightImageUrl?: string; num?: number }[]`
  - `resolveRead(part: PartId, source: ReadSource, id: string): { title: string; pages: string[]; mode: 'single' | 'dual'; incomplete?: boolean; galleryIndex?: number; galleryLength?: number } | null`
  - `WORK`: `{ title, author, publisher, tags: string[], synopsis, heroImageUrl }`

- [ ] **Step 1: 写失败测试**

在 `src/data/__tests__/catalog.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { getPartMeta, listChapters, resolveRead } from '../catalog'

describe('catalog', () => {
  it('maps main counts from JSON lengths', () => {
    const m = getPartMeta('main')
    expect(m.label).toBe('本篇')
    expect(m.counts.chapters).toBe(160)
    expect(m.counts.covers).toBe(18)
    expect(m.counts.pictures).toBe(18)
    expect(m.counts.dual).toBe(41)
  })

  it('resolveRead chapter uses pages when present', () => {
    const r = resolveRead('main', 'chapter', '1')
    expect(r?.title).toContain('妄想')
    expect(r?.pages.length).toBeGreaterThan(1)
    expect(r?.mode).toBe('single')
  })

  it('resolveRead covers ignores item.pages and returns one display image', () => {
    const r = resolveRead('main', 'covers', '0')
    expect(r?.pages).toHaveLength(1)
    expect(r?.galleryLength).toBe(18)
  })

  it('resolveRead dual returns left+right as two pages, mode dual', () => {
    const r = resolveRead('main', 'dual', '0')
    expect(r?.mode).toBe('dual')
    expect(r?.pages).toHaveLength(2)
  })

  it('fills summer chapter pages from adjacent cover indices when pages missing', () => {
    const r = resolveRead('summer', 'chapter', '1')
    expect(r).not.toBeNull()
    // 第1话封面 /Vol.01/5.jpg，第2话 /Vol.01/26.jpg → 5..25
    expect(r!.pages[0]).toMatch(/\/5\.jpg$/)
    expect(r!.pages.at(-1)).toMatch(/\/25\.jpg$/)
    expect(r!.incomplete).toBeFalsy()
  })

  it('returns null for invalid part id string via guard used by views', () => {
    expect(resolveRead('main', 'chapter', '9999')).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test:unit -- src/data/__tests__/catalog.spec.ts`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现类型与 catalog**

`src/types/comic.ts`：导出上方类型。

`src/data/work.ts`：固化作品文案；`heroImageUrl` 用本篇封面第 1 张。

`src/data/catalog.ts`：
- 导入全部 `book{1,2,3}-{chapters,covers,pictures,dual-pictures}.json`
- `PARTS` 映射表
- `resolveRead`：
  - `chapter`：有 `pages` 用 `pages`；无则从同卷相邻话的封面文件名解析页码区间，生成 `/dir/N.jpg` 序列；区间无效则 `pages=[leftImageUrl]` 且 `incomplete: true`
  - `covers` / `pictures`：`pages=[leftImageUrl]`，附带 `galleryIndex`/`galleryLength`
  - `dual`：`pages=[leftImageUrl, rightImageUrl]`（缺 right 则单页），`mode:'dual'`
- `id`：`chapter` 用 `num` 字符串；图集用 **0-based index** 字符串

页码切段算法（必须按此实现）：

```ts
function parsePageNum(url: string): { dir: string; page: number } | null
// url 形如 ".../Vol.01/5.jpg" → { dir: ".../Vol.01", page: 5 }

function fillPagesFromNeighbors(chapters, index): string[] | null {
  // start = parse(chapters[index].leftImageUrl)
  // endExclusive = parse(next chapter in SAME dir)?.page ?? null
  // if no next in same dir, generate nothing → caller marks incomplete with single cover
  // pages = start.page .. endExclusive-1
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm run test:unit -- src/data/__tests__/catalog.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit（仅当用户要求提交时）**

```bash
git add src/types/comic.ts src/data/catalog.ts src/data/work.ts src/data/__tests__/catalog.spec.ts
git commit -m "feat: add comic catalog and read resolution"
```

---

### Task 2: 阅读偏好 composable

**Files:**
- Create: `src/composables/useReaderPrefs.ts`
- Create: `src/composables/__tests__/useReaderPrefs.spec.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `useReaderPrefs(): { direction: Ref<'rtl'|'ltr'>; dualSnap: Ref<'spread'|'page'>; toggleDirection(): void; toggleDualSnap(): void }`
  - keys: `nanatokaoru.reader.direction`（默认 `'rtl'`）、`nanatokaoru.reader.dualSnap`（默认 `'spread'`）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useReaderPrefs } from '../useReaderPrefs'

describe('useReaderPrefs', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to rtl and spread', () => {
    const p = useReaderPrefs()
    expect(p.direction.value).toBe('rtl')
    expect(p.dualSnap.value).toBe('spread')
  })

  it('persists direction toggle', () => {
    const a = useReaderPrefs()
    a.toggleDirection()
    expect(a.direction.value).toBe('ltr')
    const b = useReaderPrefs()
    expect(b.direction.value).toBe('ltr')
  })
})
```

- [ ] **Step 2: 跑测确认失败** → `npm run test:unit -- src/composables/__tests__/useReaderPrefs.spec.ts`

- [ ] **Step 3: 实现 `useReaderPrefs`**（读写 localStorage；非法值回退默认）

- [ ] **Step 4: 跑测确认通过**

- [ ] **Step 5: Commit（仅当用户要求）**

---

### Task 3: 视觉 token 与全局样式

**Files:**
- Modify: `src/assets/base.css`
- Modify: `src/assets/main.css`
- Modify: `index.html`（title、字体 link）

**Interfaces:**
- Produces CSS 变量（实现时必须使用这些名字）：
  - `--color-bg: #fff7f9`
  - `--color-surface: #ffffff`
  - `--color-accent: #d45d8d`
  - `--color-text: #3b2a33`
  - `--color-muted: #7a5a68`
  - `--radius-card: 12px`
  - `--shadow-card: 0 4px 16px rgba(59, 42, 51, 0.08)`
  - 字体：标题 `\"Source Han Serif SC\", \"Noto Serif SC\", serif`；正文 `\"Source Han Sans SC\", \"Noto Sans SC\", sans-serif`（`index.html` 用 Google Fonts 引入 Noto Serif SC + Noto Sans SC）
- 去掉依赖 `prefers-color-scheme: dark` 自动切黑的默认模板行为（专题固定浅色）

- [ ] **Step 1: 改 `index.html` title 为「奈奈与薰的SM日记」，加入字体 link**

- [ ] **Step 2: 重写 `base.css` / `main.css` 使用上述变量；body 背景 `--color-bg`**

- [ ] **Step 3: 浏览器或 `npm run dev` 打开首页确认背景浅粉白、无系统暗色翻转**（此任务无单测）

- [ ] **Step 4: Commit（仅当用户要求）**

---

### Task 4: 路由 + 专题首页

**Files:**
- Modify: `src/router/index.ts`
- Replace/rewrite: `src/views/HomeView.vue`
- Create: `src/components/PartCard.vue`
- Modify: `e2e/vue.spec.ts`（或新建 `e2e/showcase.spec.ts`）

**Interfaces:**
- Consumes: `listParts`, `WORK` from Task 1
- Produces routes:
  - `{ path:'/', name:'home', component: HomeView }`
  - `{ path:'/part/:part', name:'part', component: PartView }`（PartView 可先占位空组件，Task 5 填）
  - `{ path:'/part/:part/gallery/:kind', name:'gallery', component: GalleryView }`（占位）
  - `{ path:'/read', name:'read', component: ReadView }`（占位）
- 删除旧 `/comic-detail` 与对 `WikiView` 的依赖

- [ ] **Step 1: 更新路由表；为尚未实现的视图建最小占位 SFC（仅显示路由名）**

- [ ] **Step 2: 实现 `HomeView` + `PartCard`**
  - Hero：`WORK` 字段 + CTA `RouterLink` 到 `{ name:'part', params:{ part:'main' } }`，文案「从本篇开始读」
  - 三张 `PartCard`：显示 `label`、四类 counts、`coverUrl`；点击进对应 `part`

- [ ] **Step 3: 写 e2e 冒烟**

```ts
test('home shows work title and three parts', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '奈奈与薰的SM日记' })).toBeVisible()
  await expect(page.getByText('本篇')).toBeVisible()
  await expect(page.getByText('夏日篇')).toBeVisible()
  await expect(page.getByText('高校篇')).toBeVisible()
  await page.getByRole('link', { name: /从本篇开始读/ }).click()
  await expect(page).toHaveURL(/\/part\/main/)
})
```

- [ ] **Step 4: `npm run build` 通过；e2e 在本地有浏览器时跑 `npm run test:e2e -- e2e/showcase.spec.ts`（或更新后的 vue.spec）**

- [ ] **Step 5: Commit（仅当用户要求）**

---

### Task 5: 篇页

**Files:**
- Create/rewrite: `src/views/PartView.vue`
- Create: `src/components/ChapterCard.vue`

**Interfaces:**
- Consumes: `getPartMeta`, `listChapters`, `isPartId`（在 catalog 导出 `function isPartId(v: string): v is PartId`）
- 无效 `part` → `router.replace({ name:'home' })`

- [ ] **Step 1: 实现 `PartView`**
  - 顶栏返回首页
  - 「特别展示」三入口：封面图 / 彩图 / 双页图，显示数量，链到 `gallery`
  - 「章节」网格：`ChapterCard`，`:key="\`${part}-${num}\`"`，点进 `{ name:'read', query:{ part, source:'chapter', id: String(num) } }`

- [ ] **Step 2: 单元测 `isPartId`（可补进 catalog.spec）**

```ts
it('isPartId accepts only main|summer|school', () => {
  expect(isPartId('main')).toBe(true)
  expect(isPartId('nope')).toBe(false)
})
```

- [ ] **Step 3: 手动或 e2e：打开 `/part/summer` 见「夏日篇」与三类入口数量 5/5/51**

- [ ] **Step 4: Commit（仅当用户要求）**

---

### Task 6: 图集页

**Files:**
- Create/rewrite: `src/views/GalleryView.vue`
- Create: `src/components/GalleryCard.vue`

**Interfaces:**
- Consumes: `listGallery`, `isPartId`；`kind` 校验 `covers|pictures|dual`
- 点卡片 → `/read?part=&source=&id=<index>`

- [ ] **Step 1: 实现图集网格**（dual 用左右两图并排）

- [ ] **Step 2: e2e 片段：从本篇点「双页图」进图集，URL 含 `/gallery/dual`，页面可见至少一张双页卡片

- [ ] **Step 3: Commit（仅当用户要求）**

---

### Task 7: StripReader 横带组件

**Files:**
- Create: `src/components/reader/StripReader.vue`
- Create: `src/components/reader/__tests__/stripMath.spec.ts`（纯函数可抽到同目录 `stripMath.ts`）

**Interfaces:**
- Consumes: `direction`, `dualSnap` from prefs
- Produces component props:
  - `pages: string[]`
  - `direction: 'rtl' | 'ltr'`
  - `snapMode: 'page' | 'spread'`（`spread` 仅在 `pages` 成对且调用方传入时生效；步长 2）
  - emits: `index-change(index: number)`
- 行为：横向 flex、**gap:0**；图片 `height: 100%` / `width: auto`；拖动 + wheel 横向 + 键盘；松手 snap 到步长对齐的页起点；RTL 时视觉顺序为 `row-reverse` 或等价 scroll 起点在右侧

- [ ] **Step 1: 抽 `snapIndex(rawIndex, snapMode, pageCount): number` 并测**

```ts
expect(snapIndex(1, 'spread', 4)).toBe(0) // 或 2，取距更近的偶数下标；并列取较小
expect(snapIndex(2, 'page', 4)).toBe(2)
```

- [ ] **Step 2: 实现 `StripReader.vue`**（无缝、snap、键盘；双击图片可调 `viewer` API 若已全局注册）

- [ ] **Step 3: 用 Vitest + `@vue/test-utils` 挂载后触发 keydown ArrowLeft，断言 `index-change` 按方向步进（至少覆盖 LTR 下一步 +1）**

- [ ] **Step 4: Commit（仅当用户要求）**

---

### Task 8: ReadView 接线

**Files:**
- Create/rewrite: `src/views/ReadView.vue`

**Interfaces:**
- Consumes: `resolveRead`, `useReaderPrefs`, `StripReader`
- Query: `part`, `source`, `id`
- 无效 → `replace` 到 home
- 顶栏：返回（`source==='chapter'` 回篇页，否则回对应 gallery）、标题、页码、方向切换；`mode==='dual'` 时显示停靠切换
- `incomplete` 时显示「暂无完整页」
- 封面/彩图：横带可只有 1 页；提供「上一张/下一张」按钮改 `id` 为相邻 `galleryIndex`（仍 `resolveRead`，不展开卷）

- [ ] **Step 1: 实现 ReadView**

- [ ] **Step 2: 单测或 e2e：`/read?part=main&source=covers&id=0` 页面上图片数仅为 1（不出现整卷几十张）**

- [ ] **Step 3: 手动确认 dual 默认 spread 步进；切换 page 后刷新仍保持**

- [ ] **Step 4: Commit（仅当用户要求）**

---

### Task 9: 清理旧代码与冒烟收尾

**Files:**
- Delete or stop routing: `src/views/WikiView.vue`, `src/views/ComicDetailView.vue`, `src/views/AboutView.vue`, `src/components/ChapterContainer.vue`, `src/components/ChapterDetail.vue`, `src/components/ChapterInfo.vue`, `src/components/HelloWorld.vue`, `src/components/TheWelcome.vue`, `src/components/WelcomeItem.vue`, `src/components/icons/*`, `src/stores/counter.ts`, `src/components/__tests__/HelloWorld.spec.ts`
- Keep `App.vue` 仅 `RouterView`

- [ ] **Step 1: 删除无引用模板文件；`npm run type-check` 与 `npm run test:unit` 全绿**

- [ ] **Step 2: e2e 关键路径：首页 → 本篇 → 第 1 话阅读 → 返回；首页 → 夏日篇 → 彩图图集**

- [ ] **Step 3: `npm run build` 成功**

- [ ] **Step 4: 若用户要求，一次性 commit 全部改动**

```bash
git add -A
git commit -m "feat: redesign nanatokaoru as series showcase with strip reader"
```

---

## Spec coverage checklist

| Spec 项 | Task |
|---------|------|
| 专题首页 hero + 三篇计数 | 4 |
| 篇页布局 C | 5 |
| 图集页 | 6 |
| 横带 RTL/LTR + 记忆 | 2, 7, 8 |
| 双页默认对开可切单页 | 2, 7, 8 |
| 封面/彩图只用展示图 | 1, 8 |
| 不写 pages 进 URL | 5, 6, 8 |
| 修错误标题（不再用 WikiView 硬编码） | 4–6 |
| 101/102 key | 5 |
| 缺 pages 补全 | 1 |
| 浅色视觉 | 3 |
| 清理硬编码详情 | 9 |
| 无效路由回退 | 5, 6, 8 |
| v-viewer 双击辅助 | 7 |

## Self-review notes

- 无 TBD 步骤；切段算法与 localStorage key 已钉死
- `resolveRead` 的 `id` 约定：章节用 `num`，图集用 0-based index——全计划一致
- Review Focus 五条分别落在 Task 1/5/8 测试与行为中
