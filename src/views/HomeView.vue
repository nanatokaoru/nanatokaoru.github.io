<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import PartCard from '@/components/PartCard.vue'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { useReadingProgress } from '@/composables/useReadingProgress'
import { getPartMeta, listParts } from '@/data/catalog'
import { WORK } from '@/data/work'

const parts = listParts()
const { latest } = useReadingProgress()
useDocumentTitle(null)
const DevConfigLink = import.meta.env.DEV
  ? defineAsyncComponent(() => import('@/components/DevConfigLink.vue'))
  : null

function resumeTo(part: string, id: string, page: number) {
  return {
    name: 'read' as const,
    query: { part, source: 'chapter', id, page: String(page) },
  }
}
</script>

<template>
  <div class="page home">
    <section class="hero">
      <div class="hero-visual">
        <img
          class="hero-cover"
          :src="WORK.heroImageUrl"
          :alt="WORK.title"
          width="828"
          height="1200"
          fetchpriority="high"
        />
      </div>
      <div class="hero-copy">
        <p class="eyebrow muted">甘詰留太 · 白泉社</p>
        <h1 class="display-title">{{ WORK.title }}</h1>
        <ul class="tags" aria-label="标签">
          <li v-for="tag in WORK.tags" :key="tag">{{ tag }}</li>
        </ul>
        <p class="synopsis">{{ WORK.synopsis }}</p>
        <div class="hero-actions">
          <RouterLink class="btn" :to="{ name: 'part', params: { part: 'main' } }">
            进入本篇
          </RouterLink>
          <RouterLink
            v-if="latest"
            class="btn btn-quiet"
            :to="resumeTo(latest.part, latest.id, latest.page)"
          >
            继续阅读
          </RouterLink>
        </div>
        <p v-if="latest" class="resume-note muted">
          {{ getPartMeta(latest.part).label }} · {{ latest.title }} · 第{{ latest.page }}页
        </p>
      </div>
    </section>

    <section class="parts">
      <h2 class="section-title display-title">三个篇</h2>
      <div class="part-grid">
        <PartCard
          v-for="part in parts"
          :key="part.id"
          :label="part.label"
          :cover-url="part.coverUrl"
          :chapters="part.counts.chapters"
          :covers="part.counts.covers"
          :pictures="part.counts.pictures"
          :dual="part.counts.dual"
          :to="`/part/${part.id}`"
        />
      </div>
    </section>

    <component :is="DevConfigLink" v-if="DevConfigLink" />
  </div>
</template>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
  gap: 36px;
  align-items: end;
  margin-bottom: 48px;
  padding: 8px 0 12px;
}

.hero-visual {
  background: var(--color-frame);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-card);
}

.hero-cover {
  display: block;
  width: 100%;
  height: auto;
  max-height: min(68vh, 520px);
  object-fit: contain;
  border-radius: 8px;
}

.eyebrow {
  font-size: 14px;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
}

.hero-copy h1 {
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.25;
  text-wrap: balance;
  margin-bottom: 16px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0 0 18px;
}

.tags li {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--color-frame);
  color: var(--color-muted);
  font-size: 13px;
}

.synopsis {
  margin: 0 0 24px;
  max-width: 36em;
  font-size: 16px;
  line-height: 1.7;
  color: var(--color-text);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.btn-quiet {
  background: transparent;
  color: var(--color-text);
  box-shadow: inset 0 0 0 1px rgba(59, 42, 51, 0.18);
}

.btn-quiet:hover {
  background: rgba(59, 42, 51, 0.04);
  box-shadow:
    inset 0 0 0 1px rgba(59, 42, 51, 0.28),
    var(--shadow-btn);
}

.btn-quiet:active {
  box-shadow: inset 0 0 0 1px rgba(59, 42, 51, 0.28);
}

.resume-note {
  margin-top: 10px;
  font-size: 13px;
}

.section-title {
  font-size: 22px;
  margin-bottom: 16px;
}

.part-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

@media (max-width: 800px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 20px;
    align-items: start;
  }

  .hero-visual {
    max-width: 280px;
  }

  .part-grid {
    grid-template-columns: 1fr;
  }
}
</style>
