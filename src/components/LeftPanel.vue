<template>
  <div class="nav">
    <div class="nav-header">
      <span class="nav-logo"><i class="fa-solid fa-folder-tree"></i></span>
      <span class="nav-title">导航</span>
    </div>
    <div class="nav-menu">
      <div
        v-for="item in menu"
        :key="item.key"
        class="nav-item"
        :class="{ active: activeNav === item.key }"
        @click="switchNav(item.key)"
      >
        <span class="nav-icon"><i :class="item.icon"></i></span>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </div>
    <div class="nav-footer">
      <span class="nav-hint">-- 导航区预留 --</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const activeNav = ref('home')
const emit = defineEmits(['nav-change'])

function switchNav(key) {
  activeNav.value = key
  emit('nav-change', key)
}

const menu = [
  { key: 'home',     icon: 'fa-solid fa-film',         label: '影片' },
  { key: 'actors',   icon: 'fa-solid fa-user-group',   label: '演员' },
  { key: 'settings', icon: 'fa-solid fa-gear',         label: '设置' },
]
</script>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ---- 头部 ---- */
.nav-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.nav-logo  { font-size: 20px; }
.nav-title { font-size: 15px; font-weight: 600; }

/* ---- 菜单 ---- */
.nav-menu {
  flex: 1;
  padding: 8px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  border-left: 3px solid transparent;
  transition: all 0.15s;
}
.nav-item:hover {
  background: rgba(255,255,255,0.04);
  color: var(--text-primary);
}
.nav-item.active {
  border-left-color: var(--accent);
  color: var(--text-primary);
  background: rgba(233,69,96,0.1);
}

.nav-icon  { font-size: 16px; width: 20px; text-align: center; }
.nav-label { font-weight: 500; }

/* ---- 底部 ---- */
.nav-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}
.nav-hint {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.5;
}
</style>
