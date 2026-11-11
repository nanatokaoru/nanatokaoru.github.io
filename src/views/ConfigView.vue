<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  chapterVolumeLabel,
  listChapterSpans,
  listParts,
  type ChapterSpan,
} from '@/data/catalog'
import type { PartId } from '@/types/comic'

interface Draft extends ChapterSpan {
  baseName: string
  baseStart: number
  baseEnd: number
}

const parts = listParts()
const partId = ref<PartId>('main')
const onlyOdd = ref(false)
const drafts = ref<Draft[]>([])
const saving = ref(false)
const message = ref('')
const messageOk = ref(false)
let reverting = false

function isDirty(row: Draft) {
  return row.chapterName !== row.baseName || row.start !== row.baseStart || row.end !== row.baseEnd
}

function load(part: PartId) {
  drafts.value = listChapterSpans(part).map((span) => ({
    ...span,
    baseName: span.chapterName,
    baseStart: span.start,
    baseEnd: span.end,
  }))
  message.value = ''
}

watch(
  partId,
  (next, prev) => {
    if (reverting) {
      reverting = false
      return
    }
    if (prev && drafts.value.some(isDirty) && !window.confirm('这一篇还有没保存的修改，要丢弃吗？')) {
      reverting = true
      partId.value = prev
      return
    }
    load(next)
  },
  { immediate: true },
)

const dirtyCount = computed(() => drafts.value.filter(isDirty).length)

const visible = computed(() =>
  drafts.value.filter((row) => !onlyOdd.value || row.end - row.start + 1 <= 1 || row.end - row.start + 1 > 40),
)

function pageUrl(row: Draft, page: number) {
  if (!row.dir || page < 1) return ''
  return `${row.dir}/${page}${row.ext}`
}

function setPage(row: Draft, key: 'start' | 'end', event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const value = Number(target.value)
  if (!Number.isInteger(value)) return
  row[key] = value
}

function note(row: Draft): string {
  const index = drafts.value.findIndex((item) => item.num === row.num)
  const next = drafts.value.slice(index + 1).find((item) => item.dir === row.dir)
  if (!next) return row.end === row.start ? '本卷最后一话' : ''
  if (row.end >= next.start) return '和后面一话重叠'
  if (row.end + 1 < next.start) return `中间空了 ${next.start - row.end - 1} 页`
  return ''
}

async function save() {
  const chapters = drafts.value.filter(isDirty).map((row) => ({
    num: row.num,
    chapterName: row.chapterName,
    dir: row.dir,
    ext: row.ext,
    start: row.start,
    end: row.end,
  }))
  saving.value = true
  message.value = ''
  try {
    const response = await fetch('/__config/chapters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ part: partId.value, chapters }),
    })
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!response.ok || !payload?.ok) {
      messageOk.value = false
      message.value = payload?.error || '保存失败。请用本地 npm run dev 打开这个页面。'
      return
    }
    window.location.reload()
  } catch {
    messageOk.value = false
    message.value = '保存失败。请用本地 npm run dev 打开这个页面。'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page config-page">
    <RouterLink class="back muted" :to="{ name: 'home' }">返回专题</RouterLink>
    <h1 class="display-title">章节范围</h1>
    <p class="lead muted">
      每一话现在从哪一页读到哪一页。改起止或标题后保存，阅读页会按新的页码打开。保存只在本地开发服务里写入章节文件。
    </p>

    <div class="toolbar">
      <div class="parts" role="group" aria-label="选择篇">
        <button
          v-for="part in parts"
          :key="part.id"
          type="button"
          class="part"
          :class="{ active: partId === part.id }"
          :aria-pressed="partId === part.id"
          @click="partId = part.id"
        >
          {{ part.label }}
        </button>
      </div>
      <label class="odd">
        <input v-model="onlyOdd" type="checkbox" />
        只看 1 页或超过 40 页
      </label>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>话</th>
            <th>标题</th>
            <th>卷</th>
            <th>起</th>
            <th>止</th>
            <th>页数</th>
            <th>起始页</th>
            <th>结束页</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="row.num" :class="{ dirty: isDirty(row) }">
            <td class="num">{{ row.num }}</td>
            <td>
              <input v-model="row.chapterName" class="name" type="text" maxlength="80" :aria-label="'第' + row.num + '话标题'" />
            </td>
            <td class="vol">{{ chapterVolumeLabel(row.dir + '/1.jpg') }}</td>
            <td>
              <input
                class="page-input"
                type="number"
                min="1"
                :value="row.start"
                :aria-label="'第' + row.num + '话起始页'"
                @change="setPage(row, 'start', $event)"
              />
            </td>
            <td>
              <input
                class="page-input"
                type="number"
                min="1"
                :value="row.end"
                :aria-label="'第' + row.num + '话结束页'"
                @change="setPage(row, 'end', $event)"
              />
              <p v-if="note(row)" class="warn">{{ note(row) }}</p>
            </td>
            <td class="count">{{ row.end >= row.start ? row.end - row.start + 1 : '—' }}</td>
            <td>
              <img v-if="pageUrl(row, row.start)" :src="pageUrl(row, row.start)" alt="" loading="lazy" />
            </td>
            <td>
              <img v-if="pageUrl(row, row.end)" :src="pageUrl(row, row.end)" alt="" loading="lazy" />
            </td>
            <td>
              <RouterLink
                class="open"
                :to="{ name: 'read', query: { part: partId, source: 'chapter', id: String(row.num) } }"
              >
                阅读
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="savebar">
      <span>{{ dirtyCount ? dirtyCount + ' 话已修改' : '没有未保存的修改' }}</span>
      <button type="button" class="btn" :disabled="dirtyCount === 0 || saving" @click="save">
        {{ saving ? '保存中…' : '保存到章节文件' }}
      </button>
      <span class="status" :class="{ ok: messageOk }">{{ message }}</span>
    </div>
  </div>
</template>

<style scoped>
.config-page {
  max-width: 1180px;
  padding-bottom: 96px;
}

.back {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 14px;
}

h1 {
  font-size: 32px;
  margin-bottom: 8px;
}

.lead {
  max-width: 46em;
  margin-bottom: 20px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.parts {
  display: inline-flex;
  border: 1px solid rgba(59, 42, 51, 0.15);
  border-radius: 999px;
  overflow: hidden;
  background: var(--color-surface);
}

.part {
  min-height: 44px;
  border: none;
  background: transparent;
  color: inherit;
  padding: 0 16px;
  cursor: pointer;
}

.part + .part {
  border-left: 1px solid rgba(59, 42, 51, 0.12);
}

.part.active {
  background: var(--color-accent);
  color: #fff;
}

.odd {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.table-wrap {
  overflow-x: auto;
  background: var(--color-surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid rgba(59, 42, 51, 0.08);
}

th {
  position: sticky;
  top: 0;
  background: #fff;
  font-weight: 600;
  font-size: 13px;
}

tr.dirty {
  background: rgba(176, 61, 110, 0.08);
}

.num,
.count {
  font-variant-numeric: tabular-nums;
}

.name {
  width: 180px;
  max-width: 28vw;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid rgba(59, 42, 51, 0.18);
  border-radius: 8px;
  font: inherit;
}

.page-input {
  width: 84px;
  min-height: 36px;
  padding: 6px 8px;
  border: 1px solid rgba(59, 42, 51, 0.18);
  border-radius: 8px;
  font: inherit;
  font-variant-numeric: tabular-nums;
}

.vol {
  white-space: nowrap;
  color: var(--color-muted);
}

.warn {
  margin-top: 4px;
  color: var(--color-accent);
  font-size: 12px;
}

img {
  display: block;
  height: 88px;
  width: auto;
  max-width: 72px;
  object-fit: contain;
  background: var(--color-frame);
  border-radius: 4px;
}

.open {
  color: var(--color-accent);
  font-size: 14px;
}

.savebar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  background: rgba(255, 247, 249, 0.96);
  border-top: 1px solid rgba(59, 42, 51, 0.08);
}

.status.ok {
  color: var(--color-accent);
}

.btn:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
