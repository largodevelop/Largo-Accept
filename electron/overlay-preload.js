"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayApi", {
  onState(cb) {
    ipcRenderer.on("overlay:state", (_e, on) => cb(Boolean(on)));
  },
});
