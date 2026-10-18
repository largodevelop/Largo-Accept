"use strict";

const { app, BrowserWindow, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const win32 = require("./win32");
const { createAcceptWorker } = require("./accept-worker");
const updater = require("./updater");
// FUTURE: remote phone accept via QR — see ./future-phone.js

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let acceptWorker = null;
let workerStatus = "idle";
let overlayPositionTimer = null;
let quitting = false;

const OVERLAY_W = 88;
const OVERLAY_H = 32;
const OVERLAY_MARGIN = 14;
const isDev = !app.isPackaged;

function getPublicDir() {
  if (isDev) return path.join(__dirname, "..", "public");
  return path.join(process.resourcesPath, "app.asar.unpacked", "public");
}

function isWorkerRunning() {
  return Boolean(acceptWorker && acceptWorker.isRunning());
}

function getBrandTrayImage() {
  const ico = path.join(getPublicDir(), "icon.ico");
  const png = path.join(getPublicDir(), "brand.png");
  let image = nativeImage.createEmpty();
  if (fs.existsSync(ico)) {
    image = nativeImage.createFromPath(ico);
  } else if (fs.existsSync(png)) {
    image = nativeImage.createFromPath(png);
  }
  if (!image.isEmpty()) {
    image = image.resize({ width: 16, height: 16 });
  }
  return image;
}

// ---- автообновление ----
let updateInfo = null;
let updating = false;

function broadcastUpdate(extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // полоса загрузки на кнопке в панели задач: -1 убирает, 2 — «идёт, сколько неизвестно»
    if (typeof extra.progress === "number") mainWindow.setProgressBar(extra.progress);
    else if (!updating || extra.error) mainWindow.setProgressBar(-1);
    mainWindow.webContents.send("update:changed", { available: Boolean(updateInfo), latest: updateInfo?.latest || "", updating, ...extra });
  }
  updateTrayMenu();
}

async function checkUpdates() {
  if (!app.isPackaged && !process.env.LARGO_UPDATE_API) return;
  if (updating) return;
  const info = await updater.checkForUpdate(app.getVersion());
  updateInfo = info.available ? info : null;
  broadcastUpdate();
}

async function installUpdate() {
  if (!updateInfo || updating) return { ok: false };
  updating = true;
  broadcastUpdate({ progress: 0 });
  try {
    const zip = await updater.download(updateInfo, (progress) => broadcastUpdate({ progress }));
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setProgressBar(1);
    broadcastUpdate({ progress: 1 });
    await new Promise((resolve) => setTimeout(resolve, 1500)); // полная полоса видна, потом приложение закрывается и обновляется
    const exe = process.execPath;
    updater.applyAndRestart(zip, path.dirname(exe), exe, process.pid);
    quitting = true;
    app.quit();
    return { ok: true };
  } catch (error) {
    updating = false;
    broadcastUpdate({ error: String(error && error.message || error) });
    return { ok: false, error: String(error && error.message || error) };
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const running = isWorkerRunning();
  tray.setToolTip(running ? "Largo Accept — ON" : "Largo Accept — OFF");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Largo Accept", enabled: false },
      { label: running ? "Статус: ON" : "Статус: OFF", enabled: false },
      { type: "separator" },
      {
        label: running ? "Выключить (F10)" : "Включить (F10)",
        click: () => toggleAccept(),
      },
      {
        label: "Открыть",
        click: () => {
          if (!mainWindow) return;
          mainWindow.show();
          mainWindow.focus();
        },
      },
      ...(updateInfo
        ? [{ label: `Обновить до ${updateInfo.latest}`, click: () => installUpdate() }, { type: "separator" }]
        : [{ type: "separator" }]),
      { label: "Выход", click: () => app.quit() },
    ])
  );
}

function createTray() {
  const image = getBrandTrayImage();
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.on("double-click", () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });
  updateTrayMenu();
}

function destroyTray() {
  if (tray) {
    try {
      tray.destroy();
    } catch (_) {
      /* ignore */
    }
  }
  tray = null;
}

function broadcastAcceptState() {
  const running = isWorkerRunning();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("accept:changed", { running, status: workerStatus });
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay:state", running);
  }
  updateTrayMenu();
}

function stopAcceptWorker() {
  if (acceptWorker) acceptWorker.stop();
  broadcastAcceptState();
}

function startAcceptWorker() {
  if (!acceptWorker) acceptWorker = createAcceptWorker({
      onStatus: (status) => {
        workerStatus = status;
        broadcastAcceptState();
      },
    });
  acceptWorker.start();
  broadcastAcceptState();
  return { ok: true, running: true };
}

function toggleAccept() {
  if (isWorkerRunning()) {
    stopAcceptWorker();
    return { ok: true, running: false };
  }
  return startAcceptWorker();
}

function placeOverlayOnDisplay(display) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const area = display.bounds;
  const x = Math.round(area.x + area.width - OVERLAY_W - OVERLAY_MARGIN);
  const y = Math.round(area.y + OVERLAY_MARGIN);
  overlayWindow.setBounds({ x, y, width: OVERLAY_W, height: OVERLAY_H }, false);
  try {
    overlayWindow.setAlwaysOnTop(true, "screen-saver");
  } catch (_) {
    overlayWindow.setAlwaysOnTop(true);
  }
}

async function positionOverlayNearDota() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const hwnd = win32.findDotaWindow();
  const rect = hwnd ? win32.getClientRectOnScreen(hwnd) : null;
  let display;
  if (rect) {
    display = screen.getDisplayNearestPoint(
      screen.screenToDipPoint({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
    );
  } else {
    display = screen.getPrimaryDisplay();
  }
  placeOverlayOnDisplay(display);
}

function destroyOverlay() {
  if (overlayPositionTimer) {
    clearInterval(overlayPositionTimer);
    overlayPositionTimer = null;
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    try {
      overlayWindow.setClosable(true);
      overlayWindow.destroy();
    } catch (_) {
      /* ignore */
    }
  }
  overlayWindow = null;
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: OVERLAY_W,
    height: OVERLAY_H,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    show: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "overlay-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(getPublicDir(), "overlay.html"));

  overlayWindow.webContents.on("did-finish-load", () => {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    broadcastAcceptState();
    positionOverlayNearDota().then(() => {
      if (!quitting && overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.showInactive();
      }
    });
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  overlayPositionTimer = setInterval(() => {
    if (!quitting) positionOverlayNearDota();
  }, 1000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 280,
    height: 164,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    backgroundColor: "#121212",
    show: false,
    title: "Largo Accept",
    icon: path.join(getPublicDir(), "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(getPublicDir(), "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function fullCleanup() {
  quitting = true;
  globalShortcut.unregisterAll();
  stopAcceptWorker();
  destroyOverlay();
  destroyTray();
}

ipcMain.handle("accept:status", () => ({ running: isWorkerRunning(), status: workerStatus }));
ipcMain.handle("accept:start", () => startAcceptWorker());
ipcMain.handle("accept:stop", () => {
  stopAcceptWorker();
  return { ok: true, running: false };
});
ipcMain.handle("accept:toggle", () => toggleAccept());
ipcMain.handle("update:status", () => ({ available: Boolean(updateInfo), latest: updateInfo?.latest || "", updating }));
ipcMain.handle("update:install", () => installUpdate());
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:close", () => app.quit());

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createOverlayWindow();
    createTray();
    globalShortcut.register("F10", () => toggleAccept());
    setTimeout(() => checkUpdates(), 5000);
    setInterval(() => checkUpdates(), 5 * 60 * 1000);
  });

  app.on("before-quit", () => fullCleanup());
  app.on("will-quit", () => fullCleanup());
  app.on("window-all-closed", () => {
    fullCleanup();
    if (process.platform !== "darwin") app.quit();
  });
}
