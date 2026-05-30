<template>
  <div class="settings">
    <div class="settings-header">
      <h2><i class="fa-solid fa-gear"></i> 设置</h2>
    </div>

    <div class="settings-body">
      <!-- 播放器设置区 -->
      <div class="card">
        <div class="card-title"><i class="fa-solid fa-play"></i> 播放器设置</div>
        <div class="card-desc">选择播放视频时使用的播放器。</div>

        <div class="radio-group">
          <label class="radio-item" :class="{ active: playerType === 'builtin' }">
            <input type="radio" v-model="playerType" value="builtin" />
            <span class="radio-dot"></span>
            <span>内置播放器</span>
          </label>
          <label class="radio-item" :class="{ active: playerType === 'system' }">
            <input type="radio" v-model="playerType" value="system" />
            <span class="radio-dot"></span>
            <span>默认播放器</span>
          </label>
          <label class="radio-item" :class="{ active: playerType === 'custom' }">
            <input type="radio" v-model="playerType" value="custom" />
            <span class="radio-dot"></span>
            <span>自定义播放器</span>
          </label>
        </div>

        <div v-if="playerType === 'custom'" class="exe-select">
          <input
            class="exe-path ellipsis"
            :value="exePath"
            readonly
            :placeholder="'点击右侧按钮选择播放器程序'"
          />
          <button class="btn btn-outline" @click="selectExe"><i class="fa-solid fa-folder-open"></i> 浏览</button>
        </div>
      </div>

      <!-- 导入设置区 -->
      <div class="card">
        <div class="card-title"><i class="fa-solid fa-file-video"></i> 视频导入</div>
        <div class="card-desc">添加包含视频文件的目录，点击"开始导入"将所有视频写入影片库。</div>

        <!-- 已添加的目录列表 -->
        <div class="dir-list">
          <div v-for="(dir, idx) in directories" :key="idx" class="dir-item">
            <span class="dir-icon"><i class="fa-solid fa-folder"></i></span>
            <span class="dir-path ellipsis" :title="dir">{{ dir }}</span>
            <button class="dir-remove" @click="removeDir(idx)" title="移除"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div v-if="directories.length === 0" class="dir-empty">
            尚未添加任何目录，点击下方按钮添加
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="dir-actions">
          <button class="btn btn-outline" @click="selectDir"><i class="fa-solid fa-plus"></i> 添加目录</button>
        </div>

        <!-- 视频扩展名 -->
        <div class="ext-group">
          <span class="ext-label">扫描扩展名：</span>
          <input
            v-model="extInput"
            class="ext-input"
            placeholder="mp4,avi,mkv,wmv,mov,flv"
            @blur="parseExt"
            @keyup.enter="parseExt"
          />
        </div>

        <!-- 导入按钮 + 结果 -->
        <div class="import-section">
          <button
            class="btn btn-primary"
            :disabled="importing || directories.length === 0"
            @click="startImport"
          >
            <span v-if="importing"><i class="fa-solid fa-spinner fa-spin"></i> 正在导入...</span>
            <span v-else><i class="fa-solid fa-rocket"></i> 开始导入</span>
          </button>

          <div v-if="result !== null" class="import-result" :class="result.error ? 'has-error' : ''">
            <div v-if="result.total > 0">
              共扫描 <b>{{ result.total }}</b> 个视频，
              导入 <b class="c-green">{{ result.imported }}</b> 个，
              跳过 <b class="c-yellow">{{ result.skipped }}</b> 个
            </div>
            <div v-else>未找到匹配的视频文件</div>
            <div v-if="result.errors && result.errors.length > 0" class="error-list">
              <div v-for="(e, i) in result.errors" :key="i" class="error-msg"><i class="fa-solid fa-triangle-exclamation"></i> {{ e }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const api = window.electronAPI

const directories = ref([])
const extInput = ref('mp4,avi,mkv,wmv,mov,flv')
const extensions = ref(['mp4', 'avi', 'mkv', 'wmv', 'mov', 'flv'])
const importing = ref(false)
const result = ref(null)

// 播放器设置
const playerType = ref('system')
const exePath = ref('')

// 目录选择
async function selectDir() {
  if (!api) return
  const dir = await api.selectDir()
  if (dir && !directories.value.includes(dir)) {
    directories.value.push(dir)
    saveDirs()
  }
}

function removeDir(idx) {
  directories.value.splice(idx, 1)
  saveDirs()
}

// 持久化目录
function saveDirs() {
  api?.setConfig({ directories: [...directories.value] })
}

// 选择播放器exe
async function selectExe() {
  if (!api) return
  const p = await api.selectExe()
  if (p) {
    exePath.value = p
    savePlayer()
  }
}

// 持久化播放器设置
function savePlayer() {
  api?.setConfig({ player: { type: playerType.value, exePath: exePath.value } })
}

// 播放器类型变化时同步保存（flush:sync 确保组件 v-if 销毁前已写入磁盘）
watch(playerType, () => savePlayer(), { flush: 'sync' })

async function loadDirs() {
  try {
    const cfg = await api?.getConfig()
    if (cfg?.directories?.length) {
      directories.value = cfg.directories
    }
    // 加载播放器设置（先设 exePath 再设 playerType，确保 save 时 exePath 已就绪）
    if (cfg?.player) {
      exePath.value = cfg.player.exePath || ''
      playerType.value = cfg.player.type || 'system'
    }
  } catch (e) {
    console.error('[设置] 加载配置失败:', e)
  }
}

// 解析扩展名
function parseExt() {
  extensions.value = extInput.value
    .split(/[,，\s]+/)
    .map(s => s.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean)
  extInput.value = extensions.value.join(', ')
}

// 导入
async function startImport() {
  if (!api || directories.value.length === 0) return
  importing.value = true
  result.value = null

  // 转为普通数组，避免 Vue Proxy 在 IPC 序列化时丢失数据
  const dirs = [...directories.value]
  const exts = [...extensions.value]

  console.log('[导入] 渲染进程发送:', { directories: dirs, extensions: exts })

  try {
    const res = await api.importVideos({
      directories: dirs,
      extensions: exts,
    })
    console.log('[导入] 渲染进程收到:', res)
    result.value = res
  } catch (e) {
    result.value = { total: 0, imported: 0, skipped: 0, error: true, errors: [String(e)] }
  } finally {
    importing.value = false
  }
}

onMounted(loadDirs)
</script>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.settings-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.settings-header h2 {
  font-size: 18px;
  font-weight: 600;
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* 卡片 */
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}
.card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.5;
}

/* 目录列表 */
.dir-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.dir-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
  font-size: 13px;
}
.dir-icon { flex-shrink: 0; font-size: 14px; }
.dir-path {
  flex: 1;
  min-width: 0;
  color: var(--text-secondary);
  font-family: 'Consolas', monospace;
  font-size: 12px;
}
.dir-remove {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  line-height: 22px;
  text-align: center;
  transition: all 0.15s;
}
.dir-remove:hover {
  background: var(--accent);
  color: #fff;
}
.dir-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
  opacity: 0.6;
}

.dir-actions {
  display: flex;
  gap: 10px;
}

/* 播放器单选组 */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.radio-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
  width: fit-content;
  min-width: 200px;
}
.radio-item:hover {
  border-color: rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.03);
}
.radio-item.active {
  border-color: var(--accent);
  background: rgba(233,69,96,0.08);
}
.radio-item input[type="radio"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}
.radio-dot {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.15s;
}
.radio-item.active .radio-dot {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 4px var(--accent);
}

/* 自定义播放器路径 */
.exe-select {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-left: 26px;
}
.exe-path {
  width: 320px;
  height: 30px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px;
  padding: 0 10px;
  font-size: 12px;
  background: rgba(255,255,255,0.04);
  color: var(--text-secondary);
  outline: none;
  font-family: 'Consolas', monospace;
  flex-shrink: 0;
}

/* 扩展名 */
.ext-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
.ext-label {
  font-size: 13px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.ext-input {
  width: 320px;
  height: 30px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px;
  padding: 0 10px;
  font-size: 12px;
  background: rgba(255,255,255,0.04);
  color: var(--text-primary);
  outline: none;
  font-family: 'Consolas', monospace;
}
.ext-input:focus { border-color: var(--accent); }

/* 导入区 */
.import-section {
  margin-top: 20px;
}

/* 通用按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.btn-outline {
  border: 1px solid rgba(255,255,255,0.15);
  background: transparent;
  color: var(--text-primary);
}
.btn-outline:hover:not(:disabled) {
  border-color: var(--accent);
  background: rgba(233,69,96,0.08);
}
.btn-primary {
  padding: 12px 48px;
  font-size: 15px;
  background: var(--accent);
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

/* 导入结果 */
.import-result {
  margin-top: 16px;
  padding: 14px 20px;
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border-color);
  font-size: 13px;
  text-align: center;
  width: fit-content;
  min-width: 320px;
  max-width: 520px;
}
.import-result.has-error {
  border-color: var(--accent);
}
.c-green  { color: #4ecdc4; }
.c-yellow { color: #f9ca24; }

.error-list {
  margin-top: 10px;
  text-align: left;
  max-height: 120px;
  overflow-y: auto;
}
.error-msg {
  font-size: 12px;
  color: var(--accent);
  padding: 3px 0;
  word-break: break-all;
}
</style>
