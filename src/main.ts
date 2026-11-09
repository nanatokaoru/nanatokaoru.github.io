import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { installAnalytics } from './analytics'
import 'viewerjs/dist/viewer.css'
import VueViewer from 'v-viewer'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueViewer)
installAnalytics(router)
app.mount('#app')
