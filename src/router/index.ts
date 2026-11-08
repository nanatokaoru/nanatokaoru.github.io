import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MissingNotice from '../components/MissingNotice.vue'

function pageTransitionMs() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--motion-duration').trim()
  const ms = raw.endsWith('ms') ? Number.parseFloat(raw) : Number.parseFloat(raw) * 1000
  return Number.isFinite(ms) ? ms : 280
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (to.path === from.path) return false
    if (!savedPosition) return { top: 0, left: 0 }
    // Wait until the leaving page is gone so the restored page has its real height.
    const wait = pageTransitionMs() + 40
    return new Promise((resolve) => {
      setTimeout(() => resolve(savedPosition), wait)
    })
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/part/:part',
      name: 'part',
      component: () => import('../views/PartView.vue'),
    },
    {
      path: '/part/:part/gallery/:kind',
      name: 'gallery',
      component: () => import('../views/GalleryView.vue'),
    },
    {
      path: '/read',
      name: 'read',
      component: () => import('../views/ReadView.vue'),
    },
    ...(import.meta.env.DEV
      ? [
          {
            path: '/config',
            name: 'config',
            component: () => import('../views/ConfigView.vue'),
          } satisfies RouteRecordRaw,
        ]
      : []),
    {
      path: '/:pathMatch(.*)*',
      name: 'missing',
      component: MissingNotice,
    },
  ],
})

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

export default router
