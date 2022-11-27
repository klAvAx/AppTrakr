// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

/***********************************
 * Electron Require Function Calls *
 ***********************************/
const { contextBridge, ipcRenderer } = require('electron');

/* Expose Specific IPC channel funcs */
contextBridge.exposeInMainWorld('ipc', {
  invokeGeneralInvoke: (data) => ipcRenderer.invoke('generalInvoke', data),
  sendTrayWindow: (data) => ipcRenderer.send('trayWindow', data),
  onElectron: (callback) => {
    ipcRenderer.on('electron', (event, args) => callback(args));
  },
  onTrayWindow: (callback) => {
    ipcRenderer.on('trayWindow', (event, args) => callback(args));
  }
});

/* Expose I18N funcs */
contextBridge.exposeInMainWorld('i18n', {
  __: async (key, value) => await ipcRenderer.invoke('i18n', { action: "translate", key, value }),
  getLangList: async () => await ipcRenderer.invoke('i18n', { action: "getLangList" })
});

/* Expose General App funcs */
contextBridge.exposeInMainWorld('app', {
  forceQuit: () => ipcRenderer.send("general", {action: "forceQuit"}),
  minimize: () => ipcRenderer.send("general", {action: "minimize"}),
  maximize: () => ipcRenderer.send("general", {action: "maximize"}),
  close: () => ipcRenderer.send("general", {action: "close"}),
  
  reload: () => ipcRenderer.send("trayWindow", {action: "reload"}),
  openDevTools: () => ipcRenderer.send("trayWindow", {action: "openDevTools"}),
  
  zoomIn: () => ipcRenderer.send("trayWindow", {action: "zoomIn"}),
  zoomOut: () => ipcRenderer.send("trayWindow", {action: "zoomOut"}),
  zoomReset: () => ipcRenderer.send("trayWindow", {action: "zoomReset"})
});
