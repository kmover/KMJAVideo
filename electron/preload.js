const { contextBridge, ipcRenderer, shell } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // 外部链接
  openExternal: (url) => shell.openExternal(url),

  // 平台信息
  platform: process.platform,

  // 数据库查询
  getMovies: (params) => ipcRenderer.invoke('db:getMovies', params),
  getMovie: (num) => ipcRenderer.invoke('db:getMovie', num),
  getActors: () => ipcRenderer.invoke('db:getActors'),

  // 目录选择 & 导入
  selectDir: () => ipcRenderer.invoke('dialog:selectDir'),
  importVideos: (params) => ipcRenderer.invoke('db:importVideos', params),

  // 播放器
  selectExe: () => ipcRenderer.invoke('dialog:selectExe'),
  playVideo: (params) => ipcRenderer.invoke('player:play', params),

  // 详情窗口
  openDetail: (num) => ipcRenderer.invoke('window:openDetail', num),

  // 跨窗口搜索
  searchInMain: (keyword, field) => ipcRenderer.send('window:search', { keyword, field }),
  onMainSearch: (callback) => ipcRenderer.on('main:search', (_event, { keyword, field }) => callback(keyword, field)),

  // 配置持久化
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (data) => ipcRenderer.invoke('config:set', data),

  // 采集
  getCollectorTasks: () => ipcRenderer.invoke('collector:getTaskList'),
  downloadCollectorImage: (name, url) => ipcRenderer.invoke('collector:downloadOne', name, url),

  // 重新从磁盘加载数据库（手动修改 db 文件后使用）
  reloadDatabase: () => ipcRenderer.invoke('db:reload'),

  // JAVDB 影片信息采集
  getUncollectedNums: () => ipcRenderer.invoke('scraper:getUncollected'),
  scrapeMovieInfo: (num, opts) => ipcRenderer.invoke('scraper:scrapeOne', num, opts),
  checkCookie: () => ipcRenderer.invoke('scraper:checkCookie'),
  onScraperProgress: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('scraper:progress', handler)
    // 返回取消监听的函数
    return () => ipcRenderer.removeListener('scraper:progress', handler)
  },
})
