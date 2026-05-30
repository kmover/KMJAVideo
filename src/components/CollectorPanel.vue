<template>
  <div class="collector">
    <!-- ========== 采集 Tab 导航 ========== -->
    <div class="scrape-tabs">
      <button
        class="scrape-tab"
        :class="{ active: scrapeTab === 'image' }"
        @click="scrapeTab = 'image'"
      >
        <i class="fa-solid fa-user-group"></i> 头像采集
      </button>
      <button
        class="scrape-tab"
        :class="{ active: scrapeTab === 'javdb' }"
        @click="scrapeTab = 'javdb'"
      >
        <i class="fa-solid fa-cloud-arrow-down"></i> JAVDB 数据采集
      </button>
    </div>

    <!-- ========== 演员头像采集 分组 ========== -->
    <div class="collect-group" v-show="scrapeTab === 'image'">
      <div class="group-header">
        <h3 class="group-title"><i class="fa-solid fa-user-group"></i> 演员头像采集</h3>
        <div class="group-stats" v-if="summary">
          <span class="gstat gstat-link">
            数据源:
            <input
              class="link-input"
              :value="gfriendsUrl"
              readonly
              @click="$event.target.select()"
              title="点击复制"
            />
            <button class="btn-copy" @click="copyText(gfriendsUrl)" title="复制链接">
              <i class="fa-solid fa-copy"></i>
            </button>
          </span>
          <span class="gstat">
            DB <b>{{ summary.dbTotal }}</b>
          </span>
          <span class="gstat">
            JSON <b>{{ summary.jsonTotal }}</b>
          </span>
          <span class="gstat" :class="summary.taskCount > 0 ? 'gstat-pending' : 'gstat-ok'">
            待下载 <b>{{ summary.taskCount }}</b>
          </span>
        </div>
      </div>

      <div class="group-body">
        <div class="group-actions">
          <button class="btn btn-accent" :disabled="running || !summary || summary.taskCount === 0"
            @click="startCollect">
            <i :class="running ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-play'"></i>
            {{ running ? '采集中...' : '开始采集' }}
          </button>
          <button class="btn btn-ghost" :disabled="running" @click="refreshTasks">
            <i class="fa-solid fa-rotate"></i> 刷新
          </button>
        </div>

        <!-- 进度条 -->
        <div class="progress-bar" v-if="running && summary && summary.taskCount > 0">
          <div class="progress-fill" :style="{ width: (progress.current / summary.taskCount * 100) + '%' }"></div>
        </div>

        <!-- 日志 -->
        <div class="log-area" ref="logRef">
          <div v-if="!summary" class="log-empty">点击「刷新」加载任务列表...</div>
          <div v-else-if="summary.taskCount === 0 && !running" class="log-empty">所有演员头像已就绪，无需下载 ✨</div>
          <template v-else>
            <div v-for="(item, i) in logs" :key="i" class="log-item" :class="'log-' + item.type">
              <span class="log-badge">{{ item.badge }}</span>
              <span class="log-msg">{{ item.msg }}</span>
              <span class="log-time">{{ item.time }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ========== 影片信息采集 分组 ========== -->
    <div class="collect-group" v-show="scrapeTab === 'javdb'">
      <div class="group-header">
        <h3 class="group-title"><i class="fa-solid fa-cloud-arrow-down"></i> 影片信息采集 (JAVDB)</h3>
        <div class="group-stats" v-if="scrapeSummary">
          <span class="gstat">
            已入库 <b>{{ scrapeSummary.collected }}</b>
          </span>
          <span class="gstat" :class="scrapeSummary.uncollected > 0 ? 'gstat-pending' : 'gstat-ok'">
            待采集 <b>{{ scrapeSummary.uncollected }}</b>
          </span>
        </div>
      </div>

      <div class="group-body">
        <div class="group-actions">
          <button v-if="!scrapeRunning" class="btn btn-accent" :disabled="!scrapeSummary || scrapeSummary.uncollected === 0"
            @click="startScrapeAll">
            <i class="fa-solid fa-play"></i>
            批量采集
          </button>
          <button v-else class="btn btn-stop" @click="stopScrape">
            <i class="fa-solid fa-stop"></i>
            停止采集
          </button>
          <button class="btn btn-ghost" :disabled="scrapeRunning" @click="refreshScrapeTasks">
            <i class="fa-solid fa-rotate"></i> 刷新
          </button>
        </div>

        <!-- 进度条 -->
        <div class="progress-bar" v-if="scrapeRunning && scrapeSummary && scrapeSummary.uncollected > 0">
          <div class="progress-fill"
            :style="{ width: (scrapeProgress.current / scrapeSummary.uncollected * 100) + '%' }"></div>
        </div>

        <!-- 日志 -->
        <div class="log-area" ref="scrapeLogRef">
          <div v-if="!scrapeSummary" class="log-empty">点击「刷新」检测待采集番号...</div>
          <div v-else-if="scrapeSummary.uncollected === 0 && !scrapeRunning" class="log-empty">所有影片信息已就绪 ✨</div>
          <template v-else>
            <div v-for="(item, i) in scrapeLogs" :key="i" class="log-item" :class="'log-' + item.type">
              <span class="log-badge">{{ item.badge }}</span>
              <span class="log-msg">{{ item.msg }}</span>
              <span class="log-time">{{ item.time }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted, watch } from 'vue'

const api = window.electronAPI

const scrapeTab = ref('image') // 'image' | 'javdb'

const gfriendsUrl = 'https://github.com/kmover/gfriends/'

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (_) {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

const summary = ref(null)
const running = ref(false)
const logs = reactive([])
const logRef = ref(null)
const progress = reactive({ current: 0 })

function fmtTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function addLog(type, msg) {
  const badgeMap = { ok: '✓', fail: '✗', info: '●', warn: '!' }
  logs.push({ type, msg, badge: badgeMap[type] || '-', time: fmtTime() })
  nextTick(() => {
    if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
  })
}

async function refreshTasks() {
  summary.value = null
  logs.splice(0)
  addLog('info', '正在分析演员数据...')
  try {
    const res = await api?.getCollectorTasks()
    if (!res) {
      addLog('fail', '获取任务失败：API 不可用')
      return
    }
    if (res.error) {
      addLog('fail', '获取任务失败：' + res.error)
      return
    }
    summary.value = res
    addLog('info', `数据库 ${res.dbTotal} 位演员，JSON 含 ${res.jsonTotal} 个头像，` +
      `共 ${res.taskCount} 个待下载`)
    if (res.taskCount === 0) {
      addLog('ok', '所有演员头像已就绪')
    }
  } catch (e) {
    addLog('fail', '分析失败：' + e.message)
  }
}

async function startCollect() {
  if (!summary.value || summary.value.taskCount === 0) return
  running.value = true
  progress.current = 0

  const tasks = summary.value.tasks
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    const idx = i + 1
    addLog('info', `[${idx}/${tasks.length}] 下载中：${t.name}`)
    try {
      const res = await api?.downloadCollectorImage(t.name, t.url)
      logs.pop()
      if (res && res.success) {
        const kb = (res.size / 1024).toFixed(0)
        addLog('ok', `[${idx}/${tasks.length}] ${t.name}  下载成功 (${kb}KB)`)
      } else {
        const err = res ? res.error : '网络错误'
        addLog('fail', `[${idx}/${tasks.length}] ${t.name}  失败：${err}`)
      }
    } catch (e) {
      logs.pop()
      addLog('fail', `[${idx}/${tasks.length}] ${t.name}  失败：${e.message}`)
    }
    progress.current = i + 1
    if (i < tasks.length - 1) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  running.value = false
  addLog('ok', `采集完成！成功下载 ${logs.filter(l => l.type === 'ok' && l.msg.includes('下载成功')).length} 个头像`)
}

onMounted(() => {
  refreshTasks()
  refreshScrapeTasks()
})

// ===================== JAVDB 影片信息采集 =====================
const scrapeSummary = ref(null)
const scrapeRunning = ref(false)
const scrapeAborted = ref(false)
const scrapeLogs = reactive([])
const scrapeLogRef = ref(null)
const scrapeProgress = reactive({ current: 0 })

// JAVDB 采集日志自动滚到底部
watch(() => scrapeLogs.length, () => {
  nextTick(() => {
    if (scrapeLogRef.value) {
      scrapeLogRef.value.scrollTop = scrapeLogRef.value.scrollHeight
    }
  })
})

async function refreshScrapeTasks() {
  scrapeSummary.value = null
  scrapeLogs.splice(0)

  // 重新从磁盘加载数据库（确保外部手动修改被同步）
  scrapeLogs.push({ type: 'info', msg: '正在同步数据库...', badge: '●', time: fmtTime() })
  try {
    const reloadRes = await api?.reloadDatabase()
    if (reloadRes && reloadRes.success) {
      scrapeLogs.push({ type: 'ok', msg: '数据库已同步', badge: '✓', time: fmtTime() })
    } else {
      scrapeLogs.push({ type: 'warn', msg: '数据库同步失败: ' + (reloadRes?.error || '未知'), badge: '!', time: fmtTime() })
    }
  } catch (_) { }

  // 检测 Cookie 文件
  try {
    const ck = await api?.checkCookie()
    if (ck && ck.exists) {
      scrapeLogs.push({ type: 'ok', msg: `Cookie 已加载 (${ck.path})`, badge: '✓', time: fmtTime() })
    } else {
      scrapeLogs.push({ type: 'warn', msg: `未检测到 Cookie 文件 (${ck ? ck.path : 'N/A'})，可能无法正常采集`, badge: '!', time: fmtTime() })
    }
  } catch (_) { }

  scrapeLogs.push({ type: 'info', msg: '正在查询待采集番号...', badge: '●', time: fmtTime() })
  try {
    const nums = await api?.getUncollectedNums()
    if (!nums) {
      scrapeLogs.push({ type: 'fail', msg: '获取失败：API 不可用', badge: '✗', time: fmtTime() })
      return
    }
    scrapeSummary.value = {
      uncollected: nums.length,
      collected: 0,
    }
    // 统计已入库数量
    try {
      const allRes = await api?.getMovies({ page: 1, pageSize: 1 })
      const collected = (allRes?.total || 0) - nums.length
      if (scrapeSummary.value) scrapeSummary.value.collected = collected > 0 ? collected : 0
      scrapeLogs.splice(0)
      scrapeLogs.push({ type: 'info', msg: `已入库 ${scrapeSummary.value.collected}，共 ${nums.length} 个番号待采集信息`, badge: '●', time: fmtTime() })
      if (nums.length > 0) {
        scrapeLogs.push({ type: 'info', msg: `示例: ${nums.slice(0, 5).join(', ')}${nums.length > 5 ? ' ...' : ''}`, badge: '●', time: fmtTime() })
      }
      if (nums.length === 0) {
        scrapeLogs.push({ type: 'ok', msg: '所有影片信息已就绪', badge: '✓', time: fmtTime() })
      }
    } catch (e) {
      scrapeLogs.push({ type: 'warn', msg: '统计已入库数量失败: ' + e.message, badge: '!', time: fmtTime() })
    }
  } catch (e) {
    scrapeLogs.push({ type: 'fail', msg: '查询失败：' + e.message, badge: '✗', time: fmtTime() })
  }
}

async function startScrapeAll() {
  if (!scrapeSummary.value || scrapeSummary.value.uncollected === 0) return
  scrapeRunning.value = true
  scrapeAborted.value = false
  scrapeProgress.current = 0
  scrapeLogs.splice(0)

  const nums = await api?.getUncollectedNums()
  if (!nums || nums.length === 0) {
    scrapeLogs.push({ type: 'ok', msg: '没有需要采集的番号', badge: '✓', time: fmtTime() })
    scrapeRunning.value = false
    return
  }

  // 注册实时进度监听（后端推送 → 前端日志）
  const unlisten = api?.onScraperProgress((data) => {
    const now = fmtTime()
    switch (data.type) {
      case 'info':
        scrapeLogs.push({ type: 'info', msg: data.msg, badge: '●', time: now })
        break
      case 'warn':
        scrapeLogs.push({ type: 'warn', msg: data.msg, badge: '!', time: now })
        break
      case 'field':
        scrapeLogs.push({ type: 'info', msg: `  ${data.ok ? '✓' : '✗'} ${data.label} : ${data.value}`, badge: ' ', time: now })
        break
      case 'ok':
        scrapeLogs.push({ type: 'ok', msg: data.msg, badge: '✓', time: now })
        break
      case 'fail':
        scrapeLogs.push({ type: 'fail', msg: data.msg, badge: '✗', time: now })
        break
    }
  })

  const total = nums.length
  let okCount = 0
  let failCount = 0

  for (let i = 0; i < total; i++) {
    // 检查是否被中止
    if (scrapeAborted.value) break

    const num = nums[i]
    const idx = i + 1

    try {
      const res = await api?.scrapeMovieInfo(num, { index: idx, total })
      if (res && res.success) {
        okCount++
      } else {
        failCount++
      }
    } catch (e) {
      failCount++
      scrapeLogs.push({ type: 'fail', msg: `[${idx}/${total}] ${num}  ✗ ${e.message}`, badge: '✗', time: fmtTime() })
    }
    scrapeProgress.current = i + 1

    // 间隔等待（最低 20 秒，避免被 javdb 拦截）
    // 拆分为小片段以便能及时响应停止操作
    if (i < total - 1 && !scrapeAborted.value) {
      const waitMs = 20000
      const tick = 500
      for (let waited = 0; waited < waitMs; waited += tick) {
        if (scrapeAborted.value) break
        await new Promise(r => setTimeout(r, tick))
      }
    }
  }

  // 取消监听
  if (unlisten) unlisten()

  scrapeRunning.value = false
  if (scrapeAborted.value) {
    scrapeLogs.push({ type: 'warn', msg: `采集已停止。成功 ${okCount} 个，失败 ${failCount} 个，剩余 ${total - okCount - failCount} 个未采集`, badge: '!', time: fmtTime() })
  } else {
    scrapeLogs.push({ type: 'ok', msg: `采集完成！成功 ${okCount} 个，失败 ${failCount} 个`, badge: '✓', time: fmtTime() })
  }
  // 刷新汇总
  await refreshScrapeTasks()
}

function stopScrape() {
  scrapeAborted.value = true
  scrapeLogs.push({ type: 'warn', msg: '正在停止采集...（当前影片采集完后终止）', badge: '!', time: fmtTime() })
}
</script>

<style scoped>
.collector {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 20px;
}

/* ---- Tab 切换栏 ---- */
.scrape-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.scrape-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  font-size: 13px;
  font-family: inherit;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.scrape-tab:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.scrape-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* ---- 分组卡片 ---- */
.collect-group {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  overflow: hidden;
}

/* -- 分组头部（标题 + 统计） -- */
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.group-title {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.group-stats {
  display: flex;
  gap: 18px;
}

.gstat {
  font-size: 12px;
  color: var(--text-secondary);
}

.gstat b {
  color: var(--text-primary);
}

.gstat-pending b {
  color: var(--accent);
}

.gstat-ok b {
  color: #4caf50;
}

.gstat-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.link-input {
  width: 220px;
  height: 22px;
  padding: 0 6px;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  outline: none;
  font-family: inherit;
}
.link-input:focus {
  border-color: var(--accent);
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}
.btn-copy:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--bg-secondary);
}

/* -- 分组主体 -- */
.group-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.group-actions {
  padding: 12px 20px;
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

/* ---- 按钮 ---- */
.btn {
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-accent {
  background: var(--accent);
  color: #fff;
}

.btn-accent:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-stop {
  background: #e53935;
  color: #fff;
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-stop:hover {
  filter: brightness(1.15);
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-ghost:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

/* ---- 进度条 ---- */
.progress-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s;
}

/* ---- 日志 ---- */
.log-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 20px 14px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
  background: rgba(0, 0, 0, 0.18);
}

.log-empty {
  color: var(--text-secondary);
  padding: 30px 0;
  text-align: center;
  font-family: inherit;
}

.log-item {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 2px 0;
}

.log-badge {
  width: 18px;
  text-align: center;
  flex-shrink: 0;
  font-weight: 700;
}

.log-msg {
  flex: 1;
  word-break: break-all;
}

.log-time {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.log-ok .log-badge {
  color: #4caf50;
}

.log-ok .log-msg {
  color: var(--text-primary);
}

.log-fail .log-badge {
  color: var(--accent);
}

.log-fail .log-msg {
  color: var(--accent);
}

.log-info .log-badge {
  color: var(--text-secondary);
}

.log-info .log-msg {
  color: var(--text-secondary);
}

.log-warn .log-badge {
  color: #ff9800;
}

.log-warn .log-msg {
  color: #ff9800;
}
</style>
