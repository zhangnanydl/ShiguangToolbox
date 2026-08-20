const browserDefaults = {
  version: 3,
  settings: { autoLaunch: true, hideAfterLaunch: false, launcherShortcut: 'Alt+X', zoomFactor: 1 },
  categories: [
    { id: 'development', name: '开发工具', icon: 'terminal' },
    { id: 'security', name: '安全测试', icon: 'shield' },
    { id: 'design', name: '设计', icon: 'palette' },
    { id: 'system', name: '系统工具', icon: 'settings' },
  ],
  tools: [
    { id: 'demo-1', name: 'Windows 终端', path: 'C:\\Windows\\System32\\cmd.exe', type: 'exe', icon: null, iconPreset: 'terminal', categoryId: 'system', favorite: true, shortcut: 'Ctrl+Alt+T', addedAt: 1, lastOpenedAt: 0, openCount: 0 },
    { id: 'demo-2', name: '文件资源管理器', path: 'C:\\Windows\\explorer.exe', type: 'exe', icon: null, iconPreset: 'folder', categoryId: 'system', favorite: true, addedAt: 2, lastOpenedAt: 0, openCount: 0 },
    { id: 'demo-3', name: 'Google Chrome', path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', type: 'exe', icon: null, iconPreset: 'browser', categoryId: 'development', favorite: true, addedAt: 3, lastOpenedAt: 0, openCount: 0 },
    { id: 'demo-4', name: 'Visual Studio Code', path: 'C:\\Tools\\Code.exe', type: 'exe', icon: null, iconPreset: 'code', categoryId: 'development', favorite: false, addedAt: 4, lastOpenedAt: 0, openCount: 0 },
    { id: 'demo-5', name: 'Wireshark', path: 'C:\\Tools\\Wireshark.exe', type: 'exe', icon: null, iconPreset: 'security', categoryId: 'security', favorite: false, addedAt: 5, lastOpenedAt: 0, openCount: 0 },
    { id: 'demo-6', name: 'WPS Office', path: 'C:\\Tools\\WPS.exe', type: 'exe', icon: null, iconPreset: 'office', categoryId: 'uncategorized', favorite: false, addedAt: 6, lastOpenedAt: 0, openCount: 0 },
    { id: 'demo-7', name: 'WizTree', path: 'C:\\Tools\\WizTree.exe', type: 'exe', icon: null, iconPreset: 'utility', categoryId: 'system', favorite: false, addedAt: 7, lastOpenedAt: 0, openCount: 0 },
    { id: 'demo-8', name: 'OBS Studio', path: 'C:\\Tools\\obs64.exe', type: 'exe', icon: null, iconPreset: 'media', categoryId: 'uncategorized', favorite: false, addedAt: 8, lastOpenedAt: 0, openCount: 0 },
  ],
}

const previewCategoryNames = ['开发工具', '安全测试', '系统管理', '网络分析', '数据库', '设计工具', '办公软件', '媒体处理', 'AI 工具', '自动化', '逆向分析', '移动开发', '云平台', '监控诊断', '文档资料', '常用脚本', '临时工具', '其他收藏']
const browserStressDefaults = {
  ...browserDefaults,
  categories: previewCategoryNames.map((name, index) => ({ id: `preview-category-${index}`, name, icon: ['terminal', 'shield', 'settings', 'globe', 'box', 'palette'][index % 6] })),
  tools: Array.from({ length: 40 }, (_, index) => ({
    ...browserDefaults.tools[index % browserDefaults.tools.length],
    id: `preview-tool-${index}`,
    name: `${browserDefaults.tools[index % browserDefaults.tools.length].name} ${index + 1}`,
    categoryId: `preview-category-${index % previewCategoryNames.length}`,
    favorite: index < 5,
    addedAt: index + 1,
  })),
}

const fallback = {
  loadState: async () => {
    const preview = new URLSearchParams(window.location.search).get('preview')
    if (preview === 'stress') return browserStressDefaults
    if (preview !== null) return browserDefaults
    const stored = JSON.parse(localStorage.getItem('toolbox-preview') || 'null')
    return stored ? { ...browserDefaults, ...stored, version: 3, settings: { ...browserDefaults.settings, ...(stored.settings || {}) } } : browserDefaults
  },
  saveState: async (state) => { localStorage.setItem('toolbox-preview', JSON.stringify(state)); return { ok: true, shortcutFailures: [] } },
  pickTools: async (mode = 'files') => [{
    id: `preview-added-${Date.now()}`,
    name: mode === 'folder' ? '示例文件夹' : '示例工具',
    path: mode === 'folder' ? 'C:\\Tools\\Example' : 'C:\\Tools\\Example.exe',
    type: mode === 'folder' ? 'folder' : 'exe',
    icon: null,
    iconPreset: mode === 'folder' ? 'folder' : 'utility',
    categoryId: 'uncategorized',
    favorite: false,
    addedAt: Date.now(),
    lastOpenedAt: 0,
    openCount: 0,
  }],
  inspectPaths: async () => [],
  refreshIcon: async () => ({ icon: null, iconResolvedFromTarget: false, resolvedTarget: '' }),
  refreshIcons: async () => ({}),
  launchTool: async () => ({ ok: true, updatedByMain: false }),
  revealTool: async () => true,
  checkPaths: async () => [],
  getFilePath: () => '',
  minimize: () => {},
  hide: () => {},
  setZoomFactor: async (factor) => Math.round(Math.min(1.25, Math.max(0.8, Number(factor) || 1)) * 10) / 10,
  quit: () => {},
  setAutoLaunch: async (enabled) => enabled,
  getAutoLaunch: async () => true,
  exportBackup: async () => ({ ok: false, canceled: true }),
  importBackup: async () => ({ ok: false, canceled: true }),
  onFocusSearch: () => () => {},
  onStateChanged: () => () => {},
}

export const api = window.toolbox || fallback
