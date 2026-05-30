/**
 * JAVDB 影片信息采集模块
 * 使用 Electron BrowserWindow (Chromium) 渲染页面 + executeJavaScript 提取数据
 * 支持从 data/javdb.com.txt 读取 Cookie 注入
 * 
 * 反检测策略：
 *   1. 伪装 Chrome 真实 User-Agent
 *   2. 覆盖 navigator.webdriver = false
 *   3. 注入 chrome 对象（部分 CDP 检测用）
 *   4. 附加常见浏览器请求头
 */
const { app, BrowserWindow, session } = require('electron')
const fs = require('fs')

let _win = null
let _destroyed = false

// 真实 Chrome macOS UA（javdb 2024年主要用这个）
const REAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ==================== Cookie 加载 ====================

/**
 * 从 data/javdb.com.txt 读取 Cookie 并注入到 session
 */
async function loadCookies(cookiePath) {
  if (!cookiePath || !fs.existsSync(cookiePath)) {
    console.log('[Scraper] Cookie 文件不存在:', cookiePath)
    return false
  }
  try {
    const text = fs.readFileSync(cookiePath, 'utf-8').trim()
    if (!text) return false

    const pairs = text.split(/[;\n\r]+/).map(s => s.trim()).filter(Boolean)
    const cookieList = []
    for (const pair of pairs) {
      const eq = pair.indexOf('=')
      if (eq > 0) {
        cookieList.push({
          name: pair.substring(0, eq).trim(),
          value: pair.substring(eq + 1).trim(),
        })
      }
    }
    if (cookieList.length === 0) return false

    const ses = session.defaultSession
    for (const c of cookieList) {
      await ses.cookies.set({
        url: 'https://javdb.com',
        name: c.name,
        value: c.value,
        domain: '.javdb.com',
        path: '/',
        sameSite: 'no_restriction',
        secure: true,
      })
    }
    console.log(`[Scraper] 已注入 ${cookieList.length} 个 Cookie`)
    return true
  } catch (e) {
    console.error('[Scraper] Cookie 加载失败:', e.message)
    return false
  }
}

// ==================== 反检测脚本 ====================

/**
 * 在页面加载前注入的反检测代码
 * 覆盖 navigator.webdriver / chrome / plugins 等自动化特征
 */
const ANTIDETECT_SCRIPT = `
(function() {
  // 1. 覆盖 navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // 2. 伪造 chrome.runtime（防止检测无 chrome 对象）
  window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {}
  };

  // 3. 伪造 plugins 数组（正常浏览器有至少 1-5 个）
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5]
  });

  // 4. 伪造 languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['zh-CN', 'zh', 'en']
  });

  // 5. 移除 __nightmare / __webdriver_evaluate 等
  delete window.__nightmare;
  delete window.__webdriver_evaluate;
  delete window.__selenium_evaluate;
  delete window.__webdriver_script_fn;
  delete window.__webdriver_script_func;
  delete window.__webdriver_script_function;
  delete window.__fxdriver_evaluate;
  delete window.__driver_evaluate;
  delete window.__webdriver_unwrapped;
  delete window.__webdriver_script_fn;

  // 6. 覆盖权限查询
  const origQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = function(parameters) {
    if (parameters.name === 'notifications') {
      return Promise.resolve({ state: Notification.permission });
    }
    return origQuery.call(this, parameters);
  };
})();
`

// ==================== BrowserWindow 工具 ====================

function createBrowserWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    show: true,
    title: 'JAVDB 采集器',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // 伪装 User-Agent
  win.webContents.setUserAgent(REAL_UA)

  // 注入反检测脚本（dom-ready 时在页面上下文中执行）
  win.webContents.on('dom-ready', () => {
    win.webContents.executeJavaScript(ANTIDETECT_SCRIPT).catch(() => {})
  })

  // 拦截请求，附加必要的浏览器请求头
  win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = REAL_UA
    details.requestHeaders['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7'
    details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    details.requestHeaders['Sec-Ch-Ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"'
    details.requestHeaders['Sec-Ch-Ua-Mobile'] = '?0'
    details.requestHeaders['Sec-Ch-Ua-Platform'] = '"Windows"'
    callback({ requestHeaders: details.requestHeaders })
  })

  // 开发环境打开 DevTools 方便调试
  if (!app.isPackaged) {
    win.webContents.openDevTools()
  }

  return win
}

/** 加载 URL 并等待页面完全渲染 */
function loadPage(win, url) {
  if (!win || win.isDestroyed()) {
    return Promise.reject(new Error('采集窗口已销毁，无法加载页面'))
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('页面加载超时(30s)')), 30000)
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timer)
      // 额外等待确保动态内容渲染
      setTimeout(resolve, 2500)
    })
    win.webContents.once('did-fail-load', (_e, code, desc) => {
      clearTimeout(timer)
      reject(new Error(`页面加载失败: ${desc} (${code})`))
    })
    win.loadURL(url)
  })
}

// ==================== 页面数据提取 ====================

function findDetailUrl(win, keyword) {
  const safeKw = keyword.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return win.webContents.executeJavaScript(`
    (() => {
      const items = document.querySelectorAll('div.movie-list .item');
      for (const item of items) {
        const strong = item.querySelector('.video-title strong');
        if (strong && strong.textContent.trim().toUpperCase() === '${safeKw}'.toUpperCase()) {
          const link = item.querySelector('a.box');
          if (link) return link.href;
        }
      }
      // 宽松匹配：取第一个结果
      const firstLink = document.querySelector('div.movie-list .item a.box');
      return firstLink ? firstLink.href : null;
    })()
  `)
}

function extractDetail(win) {
  return win.webContents.executeJavaScript(`
    (() => {
      const result = {};

      const title = document.title.split('|')[0].trim();
      result.title = title;

      const panel = document.querySelector('nav.panel.movie-panel-info');
      if (!panel) return result;

      const getValue = (label) => {
        const strongs = panel.querySelectorAll('strong');
        for (const s of strongs) {
          if (s.textContent.includes(label)) {
            const valueEl = s.parentElement.querySelector('.value');
            return valueEl ? valueEl.textContent.replace(/\\s+/g, ' ').trim() : '';
          }
        }
        return '';
      };

      const fb = panel.querySelector('.first-block .value');
      if (fb) result.num = fb.textContent.trim();

      result.release_date = getValue('日期');
      result.premiered = result.release_date;
      result.runtime = getValue('時長').replace(/\\D/g, '');
      result.director = getValue('導演');
      result.studio = getValue('片商');
      result.label = getValue('發行');
      result.plot = getValue('系列');
      result.tags = getValue('類別');

      let actors = getValue('演員');
      actors = actors.replace(/\\S*♂\\S*/g, '').replace(/♀/g, '');
      result.actors = actors.split(/\\s+/).filter(v => v).join(',');

      return result;
    })()
  `)
}

// ==================== 控制台格式化输出 ====================

function now() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function hr(char = '─', len = 60) {
  console.log(`[${now()}] ${char.repeat(len)}`)
}

function log(emoji, msg) {
  console.log(`[${now()}] ${emoji} ${msg}`)
}

// ==================== 主流程 ====================

async function scrapeMovie(num, options = {}) {
  // 如果之前被销毁过（如窗口全关），自动重置以支持重新采集
  if (_destroyed) {
    log('🔧', '检测到采集器已被销毁，正在重置...')
    resetScraper()
  }

  const emit = options.onProgress || (() => {})
  const sid = options.index ? `${options.index}/${options.total}` : '?'

  // 检查并重建已销毁的采集窗口（用户可能手动关闭了它）
  if (!_win || _win.isDestroyed()) {
    log('🔧', '检测到采集窗口不存在或已销毁，重新创建...')
    _win = null
    if (options.cookiePath) {
      await loadCookies(options.cookiePath)
    }
    _win = createBrowserWindow()
  }

  const totalStart = Date.now()
  hr('═')
  log('🔍', `开始采集番号: ${num}`)
  log('📋', `索引序号 : ${sid}`)
  emit({ type: 'info', msg: `[${sid}] 开始采集番号: ${num}` })

  try {
    // ======== 第 1 步：搜索 ========
    const t1 = Date.now()
    const searchUrl = `https://javdb.com/search?q=${encodeURIComponent(num)}&f=all`
    log('🌐', `[步骤 1/3] 加载搜索页面...`)
    emit({ type: 'info', msg: `[${sid}] 加载搜索页...` })
    await loadPage(_win, searchUrl)
    const t1e = ((Date.now() - t1) / 1000).toFixed(1)
    log('⏱', `搜索页加载完成 (耗时 ${t1e}s)`)
    emit({ type: 'info', msg: `[${sid}] 搜索页加载完成 (${t1e}s)` })

    // 统计搜索结果数量
    const searchCount = await _win.webContents.executeJavaScript(`
      document.querySelectorAll('div.movie-list .item').length
    `).catch(() => 0)
    log('📊', `搜索结果: ${searchCount} 条`)
    emit({ type: 'info', msg: `[${sid}] 搜索结果: ${searchCount} 条` })

    // ======== 第 2 步：定位详情页 ========
    const t2 = Date.now()
    log('🎯', `[步骤 2/3] 在结果中匹配番号...`)
    const detailUrl = await findDetailUrl(_win, num)
    if (!detailUrl) {
      log('❌', `搜索结果中未找到番号: ${num}（共 ${searchCount} 条结果）`)
      emit({ type: 'warn', msg: `[${sid}] 搜索结果中未找到番号（共 ${searchCount} 条结果）` })
      hr('═')
      return null
    }
    log('✅', `匹配成功 → ${detailUrl}`)
    emit({ type: 'info', msg: `[${sid}] 匹配成功` })

    // ======== 第 3 步：加载详情页 ========
    const t3 = Date.now()
    log('🌐', `[步骤 3/3] 加载详情页面...`)
    emit({ type: 'info', msg: `[${sid}] 加载详情页...` })
    await loadPage(_win, detailUrl)
    const t3e = ((Date.now() - t3) / 1000).toFixed(1)
    log('⏱', `详情页加载完成 (耗时 ${t3e}s)`)
    emit({ type: 'info', msg: `[${sid}] 详情页加载完成 (${t3e}s)` })

    // ======== 第 4 步：提取信息 ========
    const t4 = Date.now()
    log('📝', `提取影片元数据...`)
    emit({ type: 'info', msg: `[${sid}] 提取影片元数据...` })
    const info = await extractDetail(_win)
    if (!info.num) info.num = num
    info.website = detailUrl

    if (info.release_date && info.release_date.length >= 4) {
      const y = info.release_date.substring(0, 4)
      if (/^\d{4}$/.test(y)) info.year = parseInt(y)
    }

    // ======== 输出提取结果 ========
    const totalTime = ((Date.now() - totalStart) / 1000).toFixed(1)
    hr('─')
    log('📦', `提取结果 ──────────────────────────`)
    const fields = [
      ['番号', info.num],
      ['标题', info.title],
      ['发行日期', info.premiered],
      ['时长(分)', info.runtime],
      ['导演', info.director],
      ['片商', info.studio],
      ['发行商', info.label],
      ['系列', info.plot],
      ['标签', info.tags],
      ['演员', info.actors],
    ]
    for (const [label, val] of fields) {
      const mark = val && val.length > 0 ? '✓' : '✗'
      const display = val || '(无)'
      const truncated = display.length > 50 ? display.substring(0, 50) + '...' : display
      console.log(`  ${mark} ${label.padEnd(10, ' ')} : ${truncated}`)
    }
    hr('─')
    log('🏁', `采集完成 → 总耗时 ${totalTime}s | 搜索:${t1e}s | 详情:${t3e}s | 提取:${((Date.now() - t4)/1000).toFixed(1)}s`)
    hr('═')

    // 向前端推送详细提取结果
    for (const [label, val] of fields) {
      const hasVal = val && val.length > 0
      emit({ type: 'field', label, value: val || '(无)', ok: hasVal })
    }
    emit({ type: 'ok', msg: `[${sid}] ${num} 采集完成 (${totalTime}s)`, data: { title: info.title, studio: info.studio, actors: info.actors } })

    return info

  } catch (e) {
    log('💥', `采集失败: ${e.message}`)
    console.error(e)
    hr('═')
    emit({ type: 'fail', msg: `[${sid}] ${num} 采集失败: ${e.message}` })
    throw e
  }
}

function destroyScraper() {
  _destroyed = true
  if (_win) {
    _win.destroy()
    _win = null
  }
}

function resetScraper() {
  destroyScraper()
  _destroyed = false
}

module.exports = { scrapeMovie, destroyScraper, resetScraper }
