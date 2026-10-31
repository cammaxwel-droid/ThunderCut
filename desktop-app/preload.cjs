const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('thunderCutHost', Object.freeze({
  readGameTransaction: () => ipcRenderer.sendSync('thunder-cut:transaction:read'),
  writeGameTransaction: (value) => ipcRenderer.sendSync('thunder-cut:transaction:write', value),
  getLaunchContext: () => ipcRenderer.invoke('thunder-cut:get-launch-context'),
  getFullscreen: () => ipcRenderer.invoke('thunder-cut:fullscreen:get'),
  setFullscreen: (next) => ipcRenderer.invoke('thunder-cut:fullscreen:set', Boolean(next)),
  onFullscreenChange: (callback) => {
    const listener = (_event, next) => callback(Boolean(next));
    ipcRenderer.on('thunder-cut:fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('thunder-cut:fullscreen-changed', listener);
  },
}));
