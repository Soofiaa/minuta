const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  saveRecording: (data) => ipcRenderer.invoke('save-recording', data),
  getRecordings: () => ipcRenderer.invoke('get-recordings'),
  getRecordingFile: (videoPath) => ipcRenderer.invoke('get-recording-file', videoPath),
  startFloating: () => ipcRenderer.invoke('start-floating'),
  stopFloating: () => ipcRenderer.invoke('stop-floating'),
  
  // Communication for pause/resume
  sendRecordingStatus: (status) => ipcRenderer.send('recording-status', status),
  onRecordingStatus: (callback) => ipcRenderer.on('recording-status', (event, ...args) => callback(...args)),
  
  sendControlAction: (action) => ipcRenderer.send('control-action', action),
  onControlAction: (callback) => ipcRenderer.on('control-action', (event, ...args) => callback(...args)),
});
