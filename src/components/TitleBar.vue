<template>
  <div class="titlebar" @dblclick="toggleMaximize">
    <div class="titlebar-drag">
      <span class="titlebar-icon"><i class="fa-solid fa-film"></i></span>
      <span class="titlebar-title">KMJAVideo</span>
    </div>
    <div class="titlebar-controls">
      <button class="ctrl-btn" title="最小化" @click="minimize"><i class="fa-solid fa-window-minimize"></i></button>
      <button class="ctrl-btn" title="最大化" @click="toggleMaximize"><i class="fa-regular fa-window-maximize"></i></button>
      <button class="ctrl-btn ctrl-close" title="关闭" @click="closeWin"><i class="fa-solid fa-xmark"></i></button>
    </div>
  </div>
</template>

<script setup>
const api = window.electronAPI

function minimize()  { api?.minimize() }
function toggleMaximize() { api?.maximize() }
function closeWin()  { api?.close() }
</script>

<style scoped>
.titlebar {
  height: var(--titlebar-height);
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
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ctrl-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.ctrl-close:hover  { background: #e81123 !important; color: #fff; }
</style>
