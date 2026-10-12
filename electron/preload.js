"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("largoDesktop", {
  isDesktop: true,
  getStatus: () => ipcRenderer.invoke("accept:status"),
  startAccept: () => ipcRenderer.invoke("accept:start"),
  stopAccept: () => ipcRenderer.invoke("accept:stop"),
  toggleAccept: () => ipcRenderer.invoke("accept:toggle"),
  onAcceptChanged(cb) {
    ipcRenderer.on("accept:changed", (_e, state) => cb(state));
  },
  minimize: () => ipcRenderer.invoke("window:minimize"),
  close: () => ipcRenderer.invoke("window:close"),
});
