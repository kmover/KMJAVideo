const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')

const isDev = process.env.NODE_ENV === 'development'

// ---------- SQLite (sql.js WASM) ----------
let db = null

// 获取应用根目录：开发时用项目目录，打包后用 exe 所在目录（方便移动&备份）
function getAppRoot() {
  return isDev ? path.join(__dirname, '..') : path.dirname(app.getPath('exe'))
}

function getDbPath() {
  const dataDir = path.join(getAppRoot(), 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'javdata.db')
}

async function initDatabase() {
  const initSqlJs = require('sql.js')
  const dbPath = getDbPath()
  console.log('[DB] 路径:', dbPath)

  const SQL = await initSqlJs()

  if (fs.existsSync(dbPath)) {
    // 已有数据库，直接加载
    const filebuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(filebuffer)
    console.log('[DB] 加载成功')
  } else {
    // 首次运行，创建空数据库并初始化表结构
    console.log('[DB] 数据库不存在，创建新库...')
    db = new SQL.Database()
    db.run(`CREATE TABLE movies (
      num TEXT UNIQUE NOT NULL,
      path TEXT NOT NULL
    )`)
    db.run(`CREATE TABLE movies_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      num TEXT UNIQUE NOT NULL,
      title TEXT,
      originaltitle TEXT,
      studio TEXT,
      maker TEXT,
      label TEXT,
      year INTEGER,
      premiered TEXT,
      release_date TEXT,
      runtime INTEGER,
      director TEXT,
      plot TEXT,
      actors TEXT,
      tags TEXT,
      poster TEXT,
      thumb TEXT,
      website TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)
    db.run('CREATE INDEX idx_num ON movies_info (num ASC)')
    db.run('CREATE INDEX idx_year ON movies_info (year ASC)')
    // 保存到文件
    const data = db.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
    console.log('[DB] 新数据库创建完成')
  }
}

// ---------- sql.js 查询辅助 ----------
function queryAll(sql, params = {}) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function queryOne(sql, params = {}) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return row
}

function saveDatabase() {
  const data = db.export()
  fs.writeFileSync(getDbPath(), Buffer.from(data))
  console.log('[DB] 已保存到文件')
}

// ---------- 图片路径： data/thumb/{num}.jpg ----------
function resolveImg(num, resourceBase) {
  const p = path.join(resourceBase, 'data', 'thumb', num + '.jpg')
  return fs.existsSync(p) ? 'asset://' + encodeURIComponent(p) : ''
}

// ---------- 演员头像： data/actors/{actor}.jpg ----------
function resolveActorImg(actorName, resourceBase) {
  const p = path.join(resourceBase, 'data', 'actors', actorName + '.jpg')
  return fs.existsSync(p) ? 'asset://' + encodeURIComponent(p) : ''
}

function mapRow(row, resourceBase) {
  return {
    ...row,
    thumb: resolveImg(row.num, resourceBase),
    poster: resolveImg(row.num, resourceBase),
    actors: row.actors ? row.actors.split(',').map(s => s.trim()).filter(Boolean) : [],
    tags:   row.tags   ? row.tags.split(',').map(s => s.trim()).filter(Boolean)   : [],
  }
}

function getResourceBase() {
  return getAppRoot()
}

function getConfigPath() {
  return path.join(getResourceBase(), 'data', 'config.json')
}

function loadConfig() {
  const p = getConfigPath()
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  } catch (e) {
    console.error('[Config] 读取失败:', e.message)
  }
  return {}
}

function saveConfig(data) {
  const p = getConfigPath()
  try {
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.error('[Config] 保存失败:', e.message)
  }
}

// ---------- 窗口 ----------
function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '..', 'public', 'app.png')
    : path.join(__dirname, '..', 'public', 'app.png')

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // mainWindow.maximize()

  // 窗口控制（自动识别调用者，兼容主窗口和详情子窗口）
  ipcMain.on('window-minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on('window-close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // ---------- DB 查询 IPC ----------

  // 获取影片列表（分页 + 搜索 + 筛选）
  ipcMain.handle('db:getMovies', (_event, { page = 1, pageSize = 20, keyword = '', searchField = '', filterType = 'all' } = {}) => {
    try {
      const offset = (page - 1) * pageSize
      let where = 'WHERE 1=1'
      const params = {}

      // 筛选：无数据（movies_info 中无记录）
      if (filterType === 'noData') {
        where += ' AND mi.num IS NULL'
      }

      if (keyword) {
        const kw = `%${keyword}%`
        // 指定字段搜索（精确命中该字段）
        const fieldMap = {
          actors: 'mi.actors', director: 'mi.director', studio: 'mi.studio',
          maker: 'mi.maker', label: 'mi.label', tags: 'mi.tags', plot: 'mi.plot',
        }
        if (searchField && fieldMap[searchField]) {
          where += ` AND ${fieldMap[searchField]} LIKE :kw`
        } else {
          where += ` AND (m.num LIKE :kw OR mi.title LIKE :kw OR mi.actors LIKE :kw OR mi.director LIKE :kw OR mi.tags LIKE :kw OR mi.studio LIKE :kw)`
        }
        params[':kw'] = kw
      }

      const resourceBase = getResourceBase()

      // 筛选：无图（thumb 图片不存在）—— 全量查询后过滤
      if (filterType === 'noImage') {
        const allRows = queryAll(`
          SELECT m.num, m.path,
                 mi.title, mi.actors, mi.tags,
                 mi.premiered, mi.runtime, mi.director, mi.studio,
                 mi.maker, mi.label, mi.year, mi.plot
          FROM movies m
          LEFT JOIN movies_info mi ON m.num = mi.num COLLATE NOCASE
          ${where}
          ORDER BY m.num ASC
        `, params)

        const allList = allRows.map(r => mapRow(r, resourceBase))
        const filtered = allList.filter(item => !item.thumb)
        const total = filtered.length
        const list = filtered.slice(offset, offset + pageSize)

        return { total, page, pageSize, list }
      }

      // 常规分页查询（全部 / 无数据）
      const countRow = queryOne(`
        SELECT COUNT(*) as total
        FROM movies m
        LEFT JOIN movies_info mi ON m.num = mi.num COLLATE NOCASE
        ${where}
      `, params)

      params[':limit'] = pageSize
      params[':offset'] = offset

      const rows = queryAll(`
        SELECT m.num, m.path,
               mi.title, mi.actors, mi.tags,
               mi.premiered, mi.runtime, mi.director, mi.studio,
               mi.maker, mi.label, mi.year, mi.plot
        FROM movies m
        LEFT JOIN movies_info mi ON m.num = mi.num COLLATE NOCASE
        ${where}
        ORDER BY m.num ASC
        LIMIT :limit OFFSET :offset
      `, params)

      const list = rows.map(r => mapRow(r, resourceBase))

      return { total: countRow ? countRow.total : 0, page, pageSize, list }
    } catch (e) {
      console.error('[DB] getMovies error:', e)
      return { total: 0, page, pageSize, list: [] }
    }
  })

  // 获取单条影片详情
  ipcMain.handle('db:getMovie', (_event, num) => {
    try {
      const row = queryOne(`
        SELECT m.num, m.path,
               mi.title, mi.actors, mi.tags,
               mi.premiered, mi.runtime, mi.director, mi.studio,
               mi.maker, mi.label, mi.year, mi.plot
        FROM movies m
        LEFT JOIN movies_info mi ON m.num = mi.num COLLATE NOCASE
        WHERE m.num = :num COLLATE NOCASE
      `, { ':num': num })

      if (!row) return null
      return mapRow(row, getResourceBase())
    } catch (e) {
      console.error('[DB] getMovie error:', e)
      return null
    }
  })

  // 获取所有演员及影片数量、头像
  ipcMain.handle('db:getActors', () => {
    try {
      const rows = queryAll(`
        SELECT mi.actors
        FROM movies_info mi
        JOIN movies m ON m.num = mi.num COLLATE NOCASE
        WHERE mi.actors IS NOT NULL AND mi.actors != ''
      `)
      const actorMap = new Map()
      for (const r of rows) {
        const names = r.actors.split(',').map(s => s.trim()).filter(Boolean)
        for (const name of names) {
          actorMap.set(name, (actorMap.get(name) || 0) + 1)
        }
      }
      const resourceBase = getResourceBase()
      const list = Array.from(actorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          count,
          avatar: resolveActorImg(name, resourceBase),
        }))
      return list
    } catch (e) {
      console.error('[DB] getActors error:', e)
      return []
    }
  })

  // ---------- 重新从磁盘加载数据库 ----------
  ipcMain.handle('db:reload', async () => {
    try {
      const initSqlJs = require('sql.js')
      const SQL = await initSqlJs()
      const dbPath = getDbPath()
      if (fs.existsSync(dbPath)) {
        const filebuffer = fs.readFileSync(dbPath)
        db = new SQL.Database(filebuffer)
        console.log('[DB] 已从磁盘重新加载')
        return { success: true }
      }
      return { success: false, error: '数据库文件不存在' }
    } catch (e) {
      console.error('[DB] 重载失败:', e)
      return { success: false, error: e.message }
    }
  })

  // ---------- 目录选择 ----------
  ipcMain.handle('dialog:selectDir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择视频目录',
      properties: ['openDirectory']
    })
    if (result.canceled) return ''
    return result.filePaths[0] || ''
  })

  // ---------- 选择播放器 ----------
  ipcMain.handle('dialog:selectExe', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择播放器程序',
      filters: [{ name: '可执行文件', extensions: ['exe'] }],
      properties: ['openFile']
    })
    if (result.canceled) return ''
    return result.filePaths[0] || ''
  })

  // ---------- 播放视频 ----------
  ipcMain.handle('player:play', (_event, { filePath, playerType, exePath }) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, msg: '文件不存在: ' + filePath }
      }

      if (playerType === 'system') {
        // 系统默认播放器
        shell.openPath(filePath)
        return { ok: true }
      } else if (playerType === 'custom') {
        // 自定义播放器
        if (!exePath || !fs.existsSync(exePath)) {
          return { ok: false, msg: '播放器程序不存在: ' + exePath }
        }
        execFile(exePath, [filePath], (err) => {
          if (err) console.error('[播放] 启动失败:', err.message)
        })
        return { ok: true }
      } else if (playerType === 'builtin') {
        // 内置播放器窗口 — 写临时HTML避免跨域
        const playerWin = new BrowserWindow({
          width: 1024,
          height: 640,
          title: path.basename(filePath),
          autoHideMenuBar: true,
        })
        const videoUrl = 'file:///' + filePath.replace(/\\/g, '/')
        const tmpHtml = path.join(app.getPath('temp'), 'kmjavideo_player.html')
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          *{margin:0;padding:0;overflow:hidden}body{background:#000}
          video{width:100vw;height:100vh;object-fit:contain}
        </style></head><body><video src="${videoUrl}" controls autoplay></video></body></html>`
        fs.writeFileSync(tmpHtml, html, 'utf-8')
        playerWin.loadURL('file:///' + tmpHtml.replace(/\\/g, '/'))
        return { ok: true }
      }

      return { ok: false, msg: '未知的播放器类型: ' + playerType }
    } catch (e) {
      return { ok: false, msg: e.message }
    }
  })

  // ---------- 批量导入视频 ----------
  ipcMain.handle('db:importVideos', async (_event, { directories = [], extensions = [] }) => {
    console.log('[导入] 目录数:', directories.length, '扩展名:', extensions)
    console.log('[导入] 目录:', directories)

    const extSet = new Set(extensions.map(e => e.toLowerCase().trim()))
    console.log('[导入] 扩展名集合:', [...extSet])

    const stats = { total: 0, imported: 0, skipped: 0, errors: [] }

    function scanDir(dir, depth = 0) {
      let entries
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch (e) {
        stats.errors.push(`${dir}: ${e.message}`)
        return
      }
      const prefix = '  '.repeat(depth)
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath, depth + 1)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase().slice(1)
          if (extSet.has(ext)) {
            stats.total++
            const num = path.basename(entry.name, path.extname(entry.name)).toUpperCase()
            console.log(`[导入] 发现: ${entry.name} → num=${num}`)
            try {
              const exists = queryOne('SELECT num FROM movies WHERE num = :num COLLATE NOCASE', { ':num': num })
              if (exists) {
                stats.skipped++
                console.log(`[导入] 跳过: ${num} (已存在)`)
              } else {
                db.run('INSERT INTO movies (num, path) VALUES (?, ?)', [num, fullPath])
                stats.imported++
                console.log(`[导入] 录入: ${num}`)
              }
            } catch (e) {
              stats.errors.push(`${entry.name}: ${e.message}`)
            }
          }
        }
      }
    }

    for (const dir of directories) {
      console.log('[导入] 扫描目录:', dir)
      if (!fs.existsSync(dir)) {
        stats.errors.push(`${dir}: 目录不存在`)
        console.log('[导入] 目录不存在!')
        continue
      }
      scanDir(dir)
    }

    console.log(`[导入] 完成: total=${stats.total}, imported=${stats.imported}, skipped=${stats.skipped}`)

    if (stats.imported > 0) {
      try { saveDatabase() } catch (e) {
        stats.errors.push(`保存数据库失败: ${e.message}`)
      }
    }

    return {
      total: stats.total,
      imported: stats.imported,
      skipped: stats.skipped,
      errors: stats.errors
    }
  })

  // ---------- 数据管理 ----------

  // 数据库统计
  ipcMain.handle('db:getStats', () => {
    try {
      if (!db) return { movieCount: 0, infoCount: 0, dbSize: 0, dbPath: '' }
      const mc = queryOne('SELECT COUNT(*) as cnt FROM movies')
      const ic = queryOne('SELECT COUNT(*) as cnt FROM movies_info')
      const dbPath = getDbPath()
      const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0
      return {
        movieCount: mc ? mc.cnt : 0,
        infoCount: ic ? ic.cnt : 0,
        dbSize,
        dbPath,
      }
    } catch (e) {
      console.error('[DB] getStats error:', e)
      return { movieCount: 0, infoCount: 0, dbSize: 0, dbPath: '', error: e.message }
    }
  })

  // 清空 movies 表数据（不动 movies_info）
  ipcMain.handle('db:clearAll', () => {
    try {
      if (!db) return { success: false, error: '数据库未加载' }
      const count = queryOne('SELECT COUNT(*) as cnt FROM movies')
      db.run('DELETE FROM movies')
      saveDatabase()
      return { success: true, deletedCount: count ? count.cnt : 0 }
    } catch (e) {
      console.error('[DB] clearAll error:', e)
      return { success: false, error: e.message }
    }
  })

  // ---------- 配置读写 ----------
  ipcMain.handle('config:get', () => loadConfig())
  ipcMain.handle('config:set', (_event, data) => {
    const current = loadConfig()
    saveConfig({ ...current, ...data })
  })

  // ---------- 详情页 → 主窗口搜索 ----------
  ipcMain.on('window:search', (_event, { keyword, field }) => {
    mainWindow.webContents.send('main:search', { keyword, field })
  })

  // ---------- 打开详情子窗口 ----------
  ipcMain.handle('window:openDetail', (_event, num) => {
    const iconPath = path.join(__dirname, '..', 'public', 'app.png')

    const detailWin = new BrowserWindow({
      width: 1200,
      height: 600,
      resizable: false,
      frame: false,
      titleBarStyle: 'hidden',
      title: num,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    if (isDev) {
      detailWin.loadURL(`http://localhost:5173/?detail=${encodeURIComponent(num)}`)
      detailWin.webContents.openDevTools()
    } else {
      detailWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
        query: { detail: num }
      })
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// ---------- 自定义协议：asset:// → 本地文件 ----------
protocol.registerSchemesAsPrivileged([
  { scheme: 'asset', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
])


// ---------- 启动 ----------
app.whenReady().then(async () => {
  // 注册 asset:// 协议处理器
  protocol.handle('asset', (request) => {
    const filePath = decodeURIComponent(request.url.replace('asset://', ''))
    return net.fetch('file:///' + filePath.replace(/\\/g, '/'))
  })

  // 确保 data/ 目录存在
  const dataDir = path.join(getAppRoot(), 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  await initDatabase()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
