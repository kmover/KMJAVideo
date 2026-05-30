
<template>
  <div class="actors-panel">
    <div class="actors-header">
      <h2>演员列表</h2>
      <span class="actors-count">共 {{ actors.length }} 位</span>
    </div>

    <div class="actors-grid" v-if="actors.length">
      <div
        v-for="actor in actors"
        :key="actor.name"
        class="actor-card"
        @click="searchActor(actor.name)"
      >
        <div class="actor-avatar">
          <img :src="actor.avatar || defaultAvatar" :alt="actor.name" @error="onAvatarError" />
        </div>
        <div class="actor-name">{{ actor.name }}</div>
        <div class="actor-count">{{ actor.count }} 部</div>
      </div>
    </div>

    <div v-else class="empty">暂无数据</div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'

const api = window.electronAPI
const navigateHome = inject('navigateHome')
const actors = ref([])

const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
  <rect width="160" height="160" fill="#1a1a2e"/>
  <text x="80" y="75" text-anchor="middle" fill="#555" font-size="48" font-family="Arial">
    <tspan x="80" dy="0">&#x1F464;</tspan>
  </text>
</svg>`)

function onAvatarError(e) {
  e.target.src = defaultAvatar
}

function searchActor(name) {
  navigateHome?.()
  // 通过 main:search 事件触发 RightPanel 搜索该演员
  api?.onMainSearch(() => {}) // 先把回调挂上
  api?.searchInMain(name, 'actors')
}

onMounted(async () => {
  actors.value = await api?.getActors() || []
})
</script>

<style scoped>
.actors-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.actors-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.actors-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.actors-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.actors-grid {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  padding: 16px;
  overflow-y: auto;
  gap: 12px;
}

.actor-card {
  width: 140px;
  padding: 8px;
  border-radius: 8px;
  background: var(--bg-secondary);
  cursor: pointer;
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.actor-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.actor-avatar {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  background: #000;
  margin-bottom: 8px;
}

.actor-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.actor-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.actor-count {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
