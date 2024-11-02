import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhTw from 'element-plus/es/locale/lang/zh-tw'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, {
  locale: zhTw,
})
app.mount('#app')