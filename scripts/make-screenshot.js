"use strict";

// Делает docs/screenshot.png — снимок окна приложения во включённом состоянии.
// Запуск: npx electron scripts/make-screenshot.js

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "docs", "screenshot.png");

app.commandLine.appendSwitch("force-device-scale-factor", "2");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 280,
    height: 164,
    useContentSize: true,
    frame: false,
    show: true,
    x: 40,
    y: 40,
    skipTaskbar: true,
    backgroundColor: "#0f0f0f",
    webPreferences: { contextIsolation: true },
  });
  await win.loadFile(path.join(root, "public", "index.html"));
  await win.webContents.executeJavaScript(`
    (async () => {
      await document.fonts.ready;
      const p = document.getElementById("panel");
      p.dataset.on = "1";
      p.dataset.status = "watching";
      document.getElementById("status-label").textContent = "// ищу ready-check";
      document.getElementById("btn-toggle").className = "btn btn-outline";
      document.getElementById("brand-mark").className = "largo-brand-mark titlebar-mark is-online";
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));
  const img = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.toPNG());
  console.log("saved", out, img.getSize());
  app.quit();
});
