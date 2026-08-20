const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const isDev = !app.isPackaged
let mainWindow
let tray
let isQuitting = false
let launcherShortcut = ''
let boundsSaveTimer
const toolShortcutAccelerators = new Set()
const windowsDirectory = process.env.WINDIR || 'C:\\Windows'
const systemPresetCategory = { id: 'windows-admin', name: 'Windows 管理', icon: 'settings' }
const systemPresetTools = [
  { id: 'preset-task-manager', name: '任务管理器', path: path.join(windowsDirectory, 'System32', 'Taskmgr.exe'), type: 'exe', iconPreset: 'utility' },
  { id: 'preset-services', name: '服务管理', path: path.join(windowsDirectory, 'System32', 'services.msc'), type: 'msc', iconPreset: 'system' },
  { id: 'preset-group-policy', name: '本地组策略', path: path.join(windowsDirectory, 'System32', 'gpedit.msc'), type: 'msc', iconPreset: 'security' },
  { id: 'preset-computer-management', name: '计算机管理', path: path.join(windowsDirectory, 'System32', 'compmgmt.msc'), type: 'msc', iconPreset: 'system' },
  { id: 'preset-event-viewer', name: '事件查看器', path: path.join(windowsDirectory, 'System32', 'eventvwr.msc'), type: 'msc', iconPreset: 'utility' },
  { id: 'preset-task-scheduler', name: '任务计划程序', path: path.join(windowsDirectory, 'System32', 'taskschd.msc'), type: 'msc', iconPreset: 'terminal' },
  { id: 'preset-device-manager', name: '设备管理器', path: path.join(windowsDirectory, 'System32', 'devmgmt.msc'), type: 'msc', iconPreset: 'system' },
  { id: 'preset-resource-monitor', name: '资源监视器', path: path.join(windowsDirectory, 'System32', 'resmon.exe'), type: 'exe', iconPreset: 'utility' },
].map((tool, index) => ({
  ...tool,
  icon: null,
  categoryId: systemPresetCategory.id,
  favorite: false,
  addedAt: 10 + index,
  lastOpenedAt: 0,
  openCount: 0,
}))

const defaultState = {
  version: 4,
  settings: { autoLaunch: true, hideAfterLaunch: false, launcherShortcut: 'Alt+X', systemPresetsSeeded: true, windowBounds: null, windowLayoutVersion: 1 },
  categories: [
    { id: 'development', name: '开发工具', icon: 'terminal' },
    { id: 'security', name: '安全测试', icon: 'shield' },
    { id: 'design', name: '设计', icon: 'palette' },
    { id: 'system', name: '系统工具', icon: 'settings' },
    systemPresetCategory,
  ],
  tools: [
    { id: 'starter-terminal', name: 'Windows 终端', path: 'C:\\Windows\\System32\\cmd.exe', type: 'exe', icon: null, categoryId: 'system', favorite: true, addedAt: 1, lastOpenedAt: 0, openCount: 0 },
    { id: 'starter-explorer', name: '文件资源管理器', path: 'C:\\Windows\\explorer.exe', type: 'exe', icon: null, categoryId: 'system', favorite: false, addedAt: 2, lastOpenedAt: 0, openCount: 0 },
    ...systemPresetTools,
  ],
}

const stateFile = () => path.join(app.getPath('userData'), 'toolbox-data.json')
const loginItemOptions = (openAtLogin) => ({
  openAtLogin,
  path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
  args: ['--hidden'],
})

function readState() {
  try {
    const stored = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
    return normalizeState(stored)
  } catch {
    return defaultState
  }
}

function normalizeState(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const sourceSettings = source.settings && typeof source.settings === 'object' ? source.settings : {}
  const { zoomFactor: _legacyZoomFactor, ...normalizedSettings } = sourceSettings
  const shouldSeedSystemPresets = sourceSettings.systemPresetsSeeded !== true
  const categories = Array.isArray(source.categories) ? [...source.categories] : [...defaultState.categories]
  const tools = Array.isArray(source.tools) ? [...source.tools] : [...defaultState.tools]
  if (shouldSeedSystemPresets && !categories.some((category) => category.id === systemPresetCategory.id)) categories.push(systemPresetCategory)
  if (shouldSeedSystemPresets) {
    const existingIds = new Set(tools.map((tool) => tool.id))
    const existingPaths = new Set(tools.map((tool) => String(tool.path || '').toLowerCase()))
    for (const preset of systemPresetTools) {
      if (!existingIds.has(preset.id) && !existingPaths.has(preset.path.toLowerCase())) tools.push(preset)
    }
  }
  return {
    ...defaultState,
    ...source,
    version: 4,
    settings: {
      ...defaultState.settings,
      ...normalizedSettings,
      systemPresetsSeeded: true,
      windowLayoutVersion: Number.isFinite(sourceSettings.windowLayoutVersion) ? sourceSettings.windowLayoutVersion : 0,
    },
    categories,
    tools,
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true })
  fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2), 'utf8')
  return true
}

function notifyStateChanged(state) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('state:changed', state)
}

function registerLauncherShortcut(requested) {
  const desired = String(requested || '').trim() || 'Alt+X'
  if (launcherShortcut === desired && globalShortcut.isRegistered(desired)) return { ok: true, accelerator: desired }
  const previous = launcherShortcut
  if (previous) globalShortcut.unregister(previous)
  const candidates = [...new Set([desired, previous, 'Alt+X'].filter(Boolean))]
  for (const accelerator of candidates) {
    try {
      if (globalShortcut.register(accelerator, toggleWindow)) {
        launcherShortcut = accelerator
        return { ok: accelerator === desired, accelerator }
      }
    } catch {
      // Try the previous or default accelerator below.
    }
  }
  launcherShortcut = ''
  return { ok: false, accelerator: desired }
}

function syncToolShortcuts(state) {
  for (const accelerator of toolShortcutAccelerators) globalShortcut.unregister(accelerator)
  toolShortcutAccelerators.clear()
  if (!app.isReady()) return []

  const failures = []
  const seen = new Set([String(state.settings?.launcherShortcut || 'Alt+X').toLowerCase()])
  for (const tool of state.tools) {
    const accelerator = String(tool.shortcut || '').trim()
    if (!accelerator) continue
    const key = accelerator.toLowerCase()
    if (seen.has(key)) { failures.push(tool.id); continue }
    seen.add(key)
    try {
      const registered = globalShortcut.register(accelerator, () => { void launchManagedTool(tool) })
      if (registered) toolShortcutAccelerators.add(accelerator)
      else failures.push(tool.id)
    } catch {
      failures.push(tool.id)
    }
  }
  return failures
}

async function launchManagedTool(tool) {
  const error = await shell.openPath(tool.path)
  if (error) return { ok: false, error }
  const state = readState()
  const tools = state.tools.map((item) => item.id === tool.id
    ? { ...item, lastOpenedAt: Date.now(), openCount: (item.openCount || 0) + 1 }
    : item)
  const updated = { ...state, tools }
  writeState(updated)
  updateTrayMenu()
  notifyStateChanged(updated)
  if (updated.settings?.hideAfterLaunch) mainWindow?.hide()
  return { ok: true, error: '', updatedByMain: true }
}

function createTrayIcon() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  return icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 20, height: 20, quality: 'best' })
}

function openTrayTool(tool) {
  launchManagedTool(tool).then((result) => {
    if (!result.ok) dialog.showErrorBox('无法打开工具', result.error)
  })
}

function updateTrayMenu() {
  if (!tray) return
  const state = readState()
  tray.setToolTip(`拾光工具箱 · ${state.settings?.launcherShortcut || 'Alt+X'}`)
  const favorites = state.tools.filter((tool) => tool.favorite).slice(0, 6)
  const recent = state.tools.filter((tool) => tool.lastOpenedAt).toSorted((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 6)
  const toolSubmenu = (items, emptyLabel) => items.length
    ? items.map((tool) => ({ label: tool.name, click: () => openTrayTool(tool) }))
    : [{ label: emptyLabel, enabled: false }]

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开拾光工具箱', click: toggleWindow },
    { type: 'separator' },
    { label: '收藏工具', submenu: toolSubmenu(favorites, '暂无收藏') },
    { label: '最近使用', submenu: toolSubmenu(recent, '暂无使用记录') },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit() } },
  ]))
}

function getInitialBounds() {
  const state = readState()
  const saved = state.settings?.windowBounds
  const valid = saved && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(saved[key]))
  if (valid) {
    const visible = screen.getAllDisplays().some(({ workArea }) => (
      saved.x < workArea.x + workArea.width - 80 &&
      saved.x + saved.width > workArea.x + 80 &&
      saved.y < workArea.y + workArea.height - 60 &&
      saved.y + saved.height > workArea.y + 60
    ))
    if (visible) {
      if ((state.settings?.windowLayoutVersion || 0) >= 1) {
        return { x: saved.x, y: saved.y, width: Math.max(680, saved.width), height: Math.max(560, saved.height) }
      }

      const { workArea } = screen.getDisplayMatching(saved)
      const targetHeight = Math.max(560, Math.min(880, workArea.height - 24))
      const targetWidth = Math.max(680, Math.min(760, workArea.width - 24, targetHeight - 64))
      const migrated = {
        x: Math.round(Math.min(Math.max(saved.x + (saved.width - targetWidth) / 2, workArea.x), workArea.x + workArea.width - targetWidth)),
        y: Math.round(Math.min(Math.max(saved.y + (saved.height - targetHeight) / 2, workArea.y), workArea.y + workArea.height - targetHeight)),
        width: targetWidth,
        height: targetHeight,
      }
      writeState({ ...state, settings: { ...state.settings, windowBounds: migrated, windowLayoutVersion: 1 } })
      return migrated
    }
  }
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea
  const windowHeight = Math.max(560, Math.min(880, height - 24))
  const windowWidth = Math.max(680, Math.min(760, width - 24, windowHeight - 64))
  return {
    x: Math.round(x + (width - windowWidth) / 2),
    y: Math.round(y + (height - windowHeight) / 2),
    width: windowWidth,
    height: windowHeight,
  }
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isMinimized() || mainWindow.isMaximized()) return
  const state = readState()
  writeState({ ...state, settings: { ...state.settings, windowBounds: mainWindow.getNormalBounds(), windowLayoutVersion: 1 } })
}

function queueBoundsSave() {
  clearTimeout(boundsSaveTimer)
  boundsSaveTimer = setTimeout(saveWindowBounds, 250)
}

function normalizeShortcutPath(value) {
  if (!value) return ''
  return value
    .replace(/%([^%]+)%/g, (match, name) => process.env[name] || match)
    .replace(/,\s*-?\d+\s*$/, '')
    .replace(/^"|"$/g, '')
    .trim()
}

function resolveShortcutPath(value, workingDirectory = '') {
  const normalized = normalizeShortcutPath(value)
  if (!normalized || path.isAbsolute(normalized) || !workingDirectory) return normalized
  return path.resolve(normalizeShortcutPath(workingDirectory), normalized)
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const result = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      result[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return result
}

async function readToolIcon(filePath) {
  const isShortcut = path.extname(filePath).toLowerCase() === '.lnk'
  let resolvedTarget = ''

  if (isShortcut) {
    try {
      const shortcut = shell.readShortcutLink(filePath)
      const workingDirectory = normalizeShortcutPath(shortcut.cwd)
      resolvedTarget = resolveShortcutPath(shortcut.target, workingDirectory)
      const candidates = [resolvedTarget, resolveShortcutPath(shortcut.icon, workingDirectory)]
        .filter((candidate, index, items) => candidate && items.indexOf(candidate) === index)

      for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue
        const icon = await app.getFileIcon(candidate, { size: 'large' })
        if (!icon.isEmpty()) {
          return { icon: icon.toDataURL(), iconResolvedFromTarget: true, resolvedTarget }
        }
      }
    } catch {
      // Fall through to the shortcut file icon when the target is unavailable.
    }
  }

  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' })
    return {
      icon: icon.isEmpty() ? null : icon.toDataURL(),
      iconResolvedFromTarget: !isShortcut,
      resolvedTarget,
    }
  } catch {
    return { icon: null, iconResolvedFromTarget: false, resolvedTarget }
  }
}

function toggleWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide()
    return
  }
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('focus-search')
}

function createWindow() {
  const initialBounds = getInitialBounds()
  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: 680,
    minHeight: 560,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('move', queueBoundsSave)
  mainWindow.on('resize', queueBoundsSave)
  mainWindow.on('close', (event) => {
    clearTimeout(boundsSaveTimer)
    saveWindowBounds()
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
  mainWindow.on('blur', () => {
    // Keep the launcher open while managing tools; Alt+X remains the fast hide path.
  })

  const loadWindow = isDev
    ? mainWindow.loadURL('http://127.0.0.1:48673')
    : mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  loadWindow.then(() => {
    mainWindow.webContents.setZoomFactor(1)
    if (!process.argv.includes('--hidden')) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

async function inspectPath(filePath) {
  try {
    const stat = fs.statSync(filePath)
    const iconInfo = await readToolIcon(filePath)
    const ext = stat.isDirectory() ? '' : path.extname(filePath)
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: path.basename(filePath, ext) || path.basename(filePath),
      path: filePath,
      type: stat.isDirectory() ? 'folder' : (ext.slice(1).toLowerCase() || 'file'),
      icon: iconInfo.icon,
      iconResolvedFromTarget: iconInfo.iconResolvedFromTarget,
      resolvedTarget: iconInfo.resolvedTarget,
      categoryId: 'uncategorized',
      favorite: false,
      addedAt: Date.now(),
      lastOpenedAt: 0,
      openCount: 0,
    }
  } catch {
    return null
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else app.whenReady().then(() => {
  if (app.isPackaged) {
    const autoLaunch = readState().settings?.autoLaunch !== false
    app.setLoginItemSettings(loginItemOptions(autoLaunch))
  }
  createWindow()
  const readyState = readState()
  const launcherResult = registerLauncherShortcut(readyState.settings?.launcherShortcut)
  if (launcherResult.accelerator !== readyState.settings?.launcherShortcut) {
    readyState.settings.launcherShortcut = launcherResult.accelerator
    writeState(readyState)
  }
  syncToolShortcuts(readyState)

  tray = new Tray(createTrayIcon())
  updateTrayMenu()
  tray.on('click', toggleWindow)
})

app.on('window-all-closed', () => {})
app.on('will-quit', () => {
  if (app.isReady()) globalShortcut.unregisterAll()
})

ipcMain.handle('state:load', async () => {
  const state = readState()
  const tools = await Promise.all(state.tools.map(async (tool) => {
    const isShortcut = path.extname(tool.path).toLowerCase() === '.lnk'
    const needsRefresh = !tool.icon || (isShortcut && !tool.iconResolvedFromTarget)
    if (!needsRefresh || !fs.existsSync(tool.path)) return tool
    const iconInfo = await readToolIcon(tool.path)
    return { ...tool, ...iconInfo }
  }))
  const hydrated = { ...state, tools }
  writeState(hydrated)
  return hydrated
})
ipcMain.handle('state:save', (_event, state) => {
  const current = readState()
  const next = normalizeState({ ...state, settings: { ...state.settings, windowBounds: current.settings?.windowBounds || null } })
  const launcherResult = registerLauncherShortcut(next.settings?.launcherShortcut)
  next.settings.launcherShortcut = launcherResult.accelerator
  const saved = writeState(next)
  const shortcutFailures = syncToolShortcuts(next)
  updateTrayMenu()
  return { ok: saved, shortcutFailures, launcherShortcut: launcherResult.accelerator, launcherShortcutFailed: !launcherResult.ok }
})
ipcMain.handle('tools:pick', async (_event, mode = 'files') => {
  const pickFolder = mode === 'folder'
  const ownerWindow = BrowserWindow.fromWebContents(_event.sender) || mainWindow
  if (!ownerWindow || ownerWindow.isDestroyed()) throw new Error('工具箱窗口不可用')
  if (ownerWindow.isMinimized()) ownerWindow.restore()
  if (!ownerWindow.isVisible()) ownerWindow.show()
  ownerWindow.focus()
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: '添加到拾光工具箱',
    properties: pickFolder ? ['openDirectory'] : ['openFile', 'multiSelections'],
    filters: pickFolder ? undefined : [
      { name: '程序和快捷方式', extensions: ['exe', 'lnk', 'bat', 'cmd', 'ps1', 'url'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (result.canceled) return []
  return Promise.all(result.filePaths.map(inspectPath))
})
ipcMain.handle('tools:inspect', (_event, paths) => Promise.all(paths.map(inspectPath)))
ipcMain.handle('tools:refresh-icon', (_event, filePath) => readToolIcon(filePath))
ipcMain.handle('tools:refresh-icons', async (_event, tools) => {
  const safeTools = Array.isArray(tools) ? tools.filter((tool) => tool?.id && tool?.path && fs.existsSync(tool.path)) : []
  const icons = await mapWithConcurrency(safeTools, 4, async (tool) => [tool.id, await readToolIcon(tool.path)])
  return Object.fromEntries(icons)
})
ipcMain.handle('tools:launch', (_event, tool) => launchManagedTool(tool))
ipcMain.handle('tools:check-paths', () => {
  const state = readState()
  return state.tools.filter((tool) => !tool.path || !fs.existsSync(tool.path)).map((tool) => tool.id)
})
ipcMain.handle('tools:reveal', (_event, targetPath) => {
  shell.showItemInFolder(targetPath)
  return true
})
ipcMain.handle('settings:auto-launch', (_event, enabled) => {
  const nextValue = Boolean(enabled)
  if (app.isPackaged) app.setLoginItemSettings(loginItemOptions(nextValue))
  const state = readState()
  writeState({ ...state, settings: { ...state.settings, autoLaunch: nextValue } })
  return app.isPackaged ? app.getLoginItemSettings(loginItemOptions(nextValue)).openAtLogin : nextValue
})
ipcMain.handle('settings:get-auto-launch', () => app.isPackaged ? app.getLoginItemSettings(loginItemOptions(true)).openAtLogin : readState().settings?.autoLaunch !== false)
ipcMain.handle('settings:export', async () => {
  const stamp = new Date().toISOString().slice(0, 10)
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出工具箱备份',
    defaultPath: path.join(app.getPath('documents'), `拾光工具箱备份-${stamp}.json`),
    filters: [{ name: 'JSON 备份', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) return { ok: false, canceled: true }
  fs.writeFileSync(result.filePath, JSON.stringify(readState(), null, 2), 'utf8')
  return { ok: true, path: result.filePath }
})
ipcMain.handle('settings:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '恢复工具箱备份',
    properties: ['openFile'],
    filters: [{ name: 'JSON 备份', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true }
  try {
    const imported = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
    if (!Array.isArray(imported?.categories) || !Array.isArray(imported?.tools)) throw new Error('备份文件缺少分类或工具数据')
    const current = readState()
    const restored = normalizeState({ ...imported, settings: { ...imported.settings, windowBounds: current.settings?.windowBounds || null } })
    const launcherResult = registerLauncherShortcut(restored.settings?.launcherShortcut)
    restored.settings.launcherShortcut = launcherResult.accelerator
    writeState(restored)
    syncToolShortcuts(restored)
    updateTrayMenu()
    notifyStateChanged(restored)
    return { ok: true, state: restored }
  } catch (error) {
    return { ok: false, canceled: false, error: error.message || '无法读取备份文件' }
  }
})
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:hide', () => mainWindow?.hide())
ipcMain.on('app:quit', () => { isQuitting = true; app.quit() })

if (hasSingleInstanceLock) app.on('second-instance', () => {
  if (app.isReady()) toggleWindow()
})
