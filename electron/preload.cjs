const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('toolbox', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  pickTools: (mode) => ipcRenderer.invoke('tools:pick', mode),
  inspectPaths: (paths) => ipcRenderer.invoke('tools:inspect', paths),
  refreshIcon: (path) => ipcRenderer.invoke('tools:refresh-icon', path),
  refreshIcons: (tools) => ipcRenderer.invoke('tools:refresh-icons', tools),
  launchTool: (tool) => ipcRenderer.invoke('tools:launch', tool),
  revealTool: (path) => ipcRenderer.invoke('tools:reveal', path),
  checkPaths: () => ipcRenderer.invoke('tools:check-paths'),
  getFilePath: (file) => webUtils.getPathForFile(file),
  minimize: () => ipcRenderer.send('window:minimize'),
  hide: () => ipcRenderer.send('window:hide'),
  setZoomFactor: (factor) => ipcRenderer.invoke('window:set-zoom', factor),
  quit: () => ipcRenderer.send('app:quit'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('settings:auto-launch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('settings:get-auto-launch'),
  exportBackup: () => ipcRenderer.invoke('settings:export'),
  importBackup: () => ipcRenderer.invoke('settings:import'),
  onFocusSearch: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('focus-search', listener)
    return () => ipcRenderer.removeListener('focus-search', listener)
  },
  onStateChanged: (callback) => {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('state:changed', listener)
    return () => ipcRenderer.removeListener('state:changed', listener)
  },
})
