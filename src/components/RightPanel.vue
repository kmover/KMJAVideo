<template>
  <div class="right">
    <!-- 顶部搜索栏 -->
    <div class="top-bar">
      <select v-model="filterType" class="filter-select" @change="onFilterChange">
        <option value="all">全部</option>
        <option value="noData">无数据</option>
        <option value="noImage">无图</option>
      </select>
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索番号 / 标题 / 演员 / 导演..."
        @keyup.enter="search"
      />
      <button class="search-btn" @click="search">搜索</button>
    </div>

    <!-- 列表 -->
    <div class="content-area">
      <div class="list-view">
        <div class="image-gallery" v-loading="loading">
          <div
            v-for="item in list"
            :key="item.num"
            class="image-item"
            :title="item.title || item.num"
            @click="openDetail(item)"
          >
            <img
              :src="item.thumb || defaultThumb"
              :alt="item.num"
              @error="onImgError($event)"
            />
            <div class="num">{{ item.num }}</div>
            <div class="title">{{ item.title || item.num }}</div>
          </div>
          <div v-if="!loading && list.length === 0" class="empty">暂无数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch, onMounted } from 'vue'

const api = window.electronAPI
const pagination = inject('pagination')
const navigateHome = inject('navigateHome')
const navResetKey = inject('navResetKey')

const keyword = ref('')
const searchField = ref('')
const filterType = ref('all')
const list = ref([])
const pageSize = 12
const loading = ref(false)

// 默认占位缩略图
const defaultThumb = 'data:image/svg+xml,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="380" height="256">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#2a2a3e"/><stop offset="100%" stop-color="#1a1a2e"/>
  </linearGradient></defs>
  <rect width="380" height="256" fill="url(#g)"/>
  <text x="190" y="120" text-anchor="middle" fill="#555" font-size="36" font-family="Arial">NO IMAGE</text>
</svg>`)

// 从 DB 加载数据
async function fetchMovies() {
  if (!api) {
    console.warn('electronAPI 不可用')
    return
  }
  loading.value = true
  try {
    const res = await api.getMovies({
      page: pagination.page,
      pageSize,
      keyword: keyword.value.trim(),
      searchField: searchField.value,
      filterType: filterType.value,
    })
    list.value = res.list
    pagination.total = res.total
    pagination.totalPages = Math.ceil(res.total / pageSize) || 1
  } catch (e) {
    console.error('加载影片失败:', e)
  } finally {
    loading.value = false
  }
}

function search() {
  pagination.page = 1
  searchField.value = ''
  fetchMovies()
}

function onFilterChange() {
  pagination.page = 1
  fetchMovies()
}

// 外部调用 goPage 后通过 refreshKey 触发此侦听
watch(() => pagination.refreshKey, () => fetchMovies())

function openDetail(item) {
  if (api && api.openDetail) {
    api.openDetail(item.num)
  } else {
    console.log('详情:', item.num, item.path)
  }
}

function onImgError(e) {
  e.target.src = defaultThumb
}

onMounted(() => {
  fetchMovies()
  // 监听详情页发来的搜索
  api?.onMainSearch((kw, field) => {
    navigateHome?.(true)       // 跳过重置，keyword 由当前回调设置
    keyword.value = kw
    searchField.value = field || ''
    pagination.page = 1
    fetchMovies()
  })
})

// 导航到影片列表（首页/影片）时清除搜索，显示全部
// 包括点击同一导航项的情况（navResetKey 始终递增）
watch(navResetKey, () => {
  keyword.value = ''
  searchField.value = ''
  filterType.value = 'all'
  pagination.page = 1
  fetchMovies()
})
</script>

<style scoped>
.right {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ---- 搜索栏 ---- */
.top-bar {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.filter-select {
  height: 34px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  padding: 0 10px;
  font-size: 13px;
  background: rgba(255,255,255,0.06);
  color: var(--text-primary);
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
  flex-shrink: 0;
}
.filter-select:focus { border-color: var(--accent); }
.filter-select option {
  background: #1e1e2e;
  color: var(--text-primary);
}

.search-input {
  flex: 1;
  height: 34px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  padding: 0 14px;
  font-size: 14px;
  background: rgba(255,255,255,0.06);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus { border-color: var(--accent); }
.search-input::placeholder { color: rgba(255,255,255,0.3); }

.search-btn {
  height: 34px;
  padding: 0 20px;
  border: none;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.search-btn:hover { background: var(--accent-hover); }

/* ---- 内容区 ---- */
.content-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.list-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 图片画廊 */
.image-gallery {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-content: flex-start;
  padding: 10px;
  overflow-y: auto;
}

/* 卡片 */
.image-item {
  position: relative;
  width: 360px;
  height: 250px;
  margin: 15px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  transition: transform 0.3s ease;
  cursor: pointer;
  background: var(--bg-secondary);
}
.image-item:hover {
  transform: scale(1.05);
  z-index: 1;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: left center;
  display: block;
}

.image-item .num {
  position: absolute;
  top: 5px;
  left: 5px;
  right: 5px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 5px 10px;
  border-radius: 3px;
  text-align: center;
  font-family: Arial, sans-serif;
  font-size: 14px;
  font-weight: 600;
}

.image-item .title {
  position: absolute;
  bottom: 10px;
  left: 5px;
  right: 5px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 5px 10px;
  border-radius: 3px;
  text-align: center;
  font-family: Arial, sans-serif;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- 空状态 ---- */
.empty {
  width: 100%;
  padding: 60px 0;
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
