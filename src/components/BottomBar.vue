<template>
  <div class="bottombar">
    <div class="bottom-left">
      <span class="status-dot"></span>
      <span>就绪</span>
    </div>

    <div class="bottom-right">
      <template v-if="pagination && pagination.total > 0">
        <div class="pagination">
          <button class="page-btn" :disabled="pagination.page <= 1" @click="goPage(pagination.page - 1)">
            <i class="fa-solid fa-chevron-left"></i> 上一页
          </button>
          <span class="page-info">{{ pagination.page }} / {{ pagination.totalPages }}</span>
          <button class="page-btn" :disabled="pagination.page >= pagination.totalPages" @click="goPage(pagination.page + 1)">
            下一页 <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </template>
      <span class="ver">v{{ version }}</span>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const version = '1.0.0'

const pagination = inject('pagination', null)
const triggerRefresh = inject('triggerRefresh', null)

function goPage(p) {
  if (!pagination || !triggerRefresh || p < 1 || p > pagination.totalPages) return
  pagination.page = p
  triggerRefresh()
}
</script>

<style scoped>
.bottombar {
  height: var(--bottom-height);
  min-height: var(--bottom-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: #0d0d1a;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.bottom-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4caf50;
}

.bottom-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
}

.ver { opacity: 0.5; }

/* ---- 分页 ---- */
.pagination {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-btn {
  height: 26px;
  padding: 0 12px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text-primary);
}

.page-btn:disabled {
  opacity: 0.25;
  cursor: default;
}

.page-info {
  color: var(--text-primary);
  font-weight: 500;
  font-size: 12px;
  min-width: 50px;
  text-align: center;
}
</style>
