<template>
  <!-- 详情窗口（独立子窗口模式） -->
  <DetailWindow v-if="detailNum" :num="detailNum" />

  <!-- 主窗口 -->
  <div v-else class="app-shell">
    <!-- 自定义标题栏 -->
    <TitleBar />

    <!-- 主体：左侧导航 300px + 右侧内容铺满 -->
    <div class="main-area">
      <div class="nav-panel">
        <LeftPanel @nav-change="onNavChange" />
      </div>
      <div class="content-panel">
        <SettingsPanel v-if="currentNav === 'settings'" />
        <ActorsPanel v-else-if="currentNav === 'actors'" />
        <CollectorPanel v-else-if="currentNav === 'collect'" />
        <RightPanel v-else />
      </div>
    </div>

    <!-- 底部状态栏 -->
    <BottomBar />
  </div>
</template>

<script setup>
import { ref, reactive, provide, onMounted, onUnmounted } from 'vue'
import TitleBar from './components/TitleBar.vue'
import LeftPanel from './components/LeftPanel.vue'
import RightPanel from './components/RightPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import ActorsPanel from './components/ActorsPanel.vue'
import CollectorPanel from './components/CollectorPanel.vue'
import DetailWindow from './components/DetailWindow.vue'
import BottomBar from './components/BottomBar.vue'

const currentNav = ref('home')
const navResetKey = ref(0)
function onNavChange(key) {
  currentNav.value = key
  // 切换到影片列表时，触发搜索重置
  if (key === 'home') {
    navResetKey.value++
  }
}
function navigateHome(skipReset) {
  currentNav.value = 'home'
  if (!skipReset) {
    navResetKey.value++
  }
}

// 检测是否为详情子窗口
const detailNum = new URLSearchParams(window.location.search).get('detail') || ''

// 分页状态（共享给 RightPanel 和 BottomBar）
const pagination = reactive({
  page: 1,
  total: 0,
  totalPages: 1,
  refreshKey: 0,  // 自增触发 RightPanel 重新拉取
})
function triggerRefresh() {
  pagination.refreshKey++
}
provide('pagination', pagination)
provide('triggerRefresh', triggerRefresh)
provide('navigateHome', navigateHome)
provide('currentNav', currentNav)
provide('navResetKey', navResetKey)

// 键盘热键：⬅ ➡ 翻页（仅影片列表页生效）
function onKeyDown(e) {
  if (currentNav.value !== 'home') return                                        // 非影片列表不响应
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return    // 输入框内不响应
  if (e.key === 'ArrowLeft') {
    if (pagination.page > 1) {
      pagination.page--
      triggerRefresh()
    }
  } else if (e.key === 'ArrowRight') {
    if (pagination.page < pagination.totalPages) {
      pagination.page++
      triggerRefresh()
    }
  }
}
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.nav-panel {
  width: var(--left-width);
  min-width: var(--left-width);
  max-width: var(--left-width);
  height: 100%;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.content-panel {
  flex: 1;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}
</style>
