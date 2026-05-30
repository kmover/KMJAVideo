<template>
  <div class="detail-shell">
    <!-- 标题栏 -->
    <div class="titlebar">
      <div class="titlebar-drag">
        <span class="titlebar-icon"><i class="fa-solid fa-film"></i></span>
        <span class="titlebar-title">{{ item?.title || item?.num || '详情' }}</span>
      </div>
      <div class="titlebar-controls">
        <button class="ctrl-btn" title="最小化" @click="minimize"><i class="fa-solid fa-window-minimize"></i></button>
        <button class="ctrl-btn ctrl-close" title="关闭" @click="closeWin"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>

    <!-- 主体：左图 + 右信息 -->
    <div class="detail-body" v-if="item">
      <!-- 左侧海报区 -->
      <div class="poster-panel">
        <div class="poster-wrap" @click="play">
          <img :src="item.poster || item.thumb || defaultThumb" :alt="item.num" @error="onImgError" />
          <div class="play-overlay">
            <div class="play-icon"><i class="fa-solid fa-play"></i></div>
          </div>
        </div>
      </div>

      <!-- 右侧信息区 -->
      <div class="info-panel">
        <div class="info-title">
          <span>{{ item.num }}</span>
          <button class="copy-btn" title="复制番号" @click="copyNum"><i class="fa-regular fa-copy"></i></button>
          <span v-if="copied" class="copy-toast">已复制</span>
        </div>

        <div class="meta-grid">
          <div v-if="item.actors?.length" class="meta-row">
            <label>演员</label>
            <span class="tag-list">
              <a v-for="(a, i) in item.actors" :key="i" class="meta-link" @click.prevent="searchTag(a, 'actors')">{{ a }}</a>
            </span>
          </div>
          <div v-if="item.runtime" class="meta-row">
            <label>时长</label><span>{{ item.runtime }} 分钟</span>
          </div>
          <div v-if="item.premiered" class="meta-row">
            <label>日期</label><span>{{ item.premiered }}</span>
          </div>
          <div v-if="item.director" class="meta-row">
            <label>导演</label><span><a class="meta-link" @click.prevent="searchTag(item.director, 'director')">{{ item.director }}</a></span>
          </div>
          <div v-if="item.studio" class="meta-row">
            <label>片商</label><span><a class="meta-link" @click.prevent="searchTag(item.studio, 'studio')">{{ item.studio }}</a></span>
          </div>
          <div v-if="item.maker" class="meta-row">
            <label>制作</label><span><a class="meta-link" @click.prevent="searchTag(item.maker, 'maker')">{{ item.maker }}</a></span>
          </div>
          <div v-if="item.label" class="meta-row">
            <label>厂牌</label><span><a class="meta-link" @click.prevent="searchTag(item.label, 'label')">{{ item.label }}</a></span>
          </div>
          <div v-if="item.tags?.length" class="meta-row">
            <label>类别</label>
            <span class="tag-list">
              <a v-for="(t, i) in item.tags" :key="i" class="meta-link" @click.prevent="searchTag(t, 'tags')">{{ t }}</a>
            </span>
          </div>
          <div v-if="item.plot" class="meta-row plot-row">
            <label>简介</label><span><a class="meta-link" @click.prevent="searchTag(item.plot, 'plot')">{{ item.plot }}</a></span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="loading">加载中...</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({ num: String })
const api = window.electronAPI
const item = ref(null)
const copied = ref(false)

const defaultThumb = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="380" height="256">
  <rect width="380" height="256" fill="#1a1a2e"/>
  <text x="190" y="120" text-anchor="middle" fill="#555" font-size="36" font-family="Arial">NO IMAGE</text>
</svg>`)

async function load() {
  if (!api) return
  try {
    const data = await api.getMovie(props.num)
    item.value = data
    document.title = data?.title || data?.num || props.num
  } catch (e) {
    console.error('[Detail] 加载失败:', e)
    item.value = { num: props.num }
    document.title = props.num
  }
}

async function play() {
  if (!item.value?.path) return
  try {
    const cfg = await api?.getConfig()
    const player = cfg?.player || { type: 'system', exePath: '' }
    const res = await api.playVideo({
      filePath: item.value.path,
      playerType: player.type,
      exePath: player.exePath,
    })
    if (!res.ok) {
      console.error('[播放]', res.msg)
    }
  } catch (e) {
    console.error('[播放] 失败:', e)
  }
}

function onImgError(e) {
  e.target.src = defaultThumb
}

async function copyNum() {
  if (!item.value?.num) return
  try {
    await navigator.clipboard.writeText(item.value.num)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = item.value.num
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function searchTag(keyword, field) {
  if (!keyword) return
  api?.searchInMain(keyword, field)
}

function minimize() { api?.minimize() }
function closeWin() { api?.close() }

onMounted(load)
</script>

<style scoped>
.detail-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

/* ---- 标题栏 ---- */
.titlebar {
  height: var(--titlebar-height);
  min-height: var(--titlebar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0d0d1a;
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.titlebar-drag {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
}

.titlebar-icon { font-size: 14px; }

.titlebar-title {
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.titlebar-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.ctrl-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: #999;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.ctrl-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.ctrl-close:hover { background: #e81123 !important; color: #fff; }

/* ---- 主体：横版双栏 ---- */
.detail-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧海报 */
.poster-panel {
  width: 70%;
  min-width: 420px;
  flex-shrink: 0;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.poster-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.poster-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

/* 播放按钮悬浮层 */
.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0);
  transition: background 0.25s ease;
}

.play-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(233, 69, 96, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.2s, transform 0.2s;
}

.poster-wrap:hover .play-overlay {
  background: rgba(0, 0, 0, 0.35);
}
.poster-wrap:hover .play-icon {
  opacity: 1;
  transform: scale(1);
}

/* 右侧信息 */
.info-panel {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
}

.info-title {
  font-size: 18px;
  color: var(--text-primary);
  margin-bottom: 24px;
  font-weight: 500;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 10px;
}

.copy-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.copy-btn:hover {
  background: rgba(233, 69, 96, 0.15);
  border-color: var(--accent);
  color: var(--accent);
}

.copy-toast {
  font-size: 12px;
  color: #4caf50;
  animation: fadeInOut 1.5s ease;
}

@keyframes fadeInOut {
  0%   { opacity: 0; transform: translateY(-4px); }
  15%  { opacity: 1; transform: translateY(0); }
  75%  { opacity: 1; }
  100% { opacity: 0; }
}

.meta-grid {
  flex: 1;
}

.meta-row {
  display: flex;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
}
.meta-row label {
  width: 64px;
  flex-shrink: 0;
  color: var(--text-secondary);
}
.meta-row span {
  color: var(--text-primary);
  flex: 1;
}

.meta-link {
  color: #5ea3e6;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s;
}
.meta-link:hover {
  color: #8ec8f2;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.plot-row span {
  max-height: 80px;
  overflow-y: auto;
  line-height: 1.6;
}

/* ---- 加载 ---- */
.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
