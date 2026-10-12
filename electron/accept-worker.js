"use strict";

const { desktopCapturer, screen, nativeImage, app } = require("electron");
const fs = require("fs");
const path = require("path");
const win32 = require("./win32");
const { findAcceptButton } = require("./detector");

const TICK_MS = 500; // ready-check живёт ~30 с; захват экрана недёшев, чаще не нужно
const FRAME_WIDTH = 960; // ширина кадра окна Dota для анализа
const CONFIRM_FRAMES = 2; // кнопка должна продержаться столько кадров подряд
const GONE_FRAMES = 3; // столько кадров без кнопки = ready-check закончился
const RETRY_MS = 1300; // пауза между повторными кликами
const MAX_CLICKS = 4; // клики за одно появление кнопки
const DEBUG = process.env.LARGO_DEBUG === "1";

/**
 * Автопринятие: ищет зелёную кнопку на экране с Dota и кликает по ней.
 * onStatus(status) получает: "idle" | "no-dota" | "minimized" | "watching" | "accepting" | "accepted"
 */
function createAcceptWorker({ onStatus = () => {} } = {}) {
  let timer = null;
  let busy = false;
  let status = "idle";

  let streak = 0;
  let lastCand = null;
  let goneStreak = 0;
  let clicks = 0;
  let lastClickAt = 0;

  function setStatus(next) {
    if (next === status) return;
    status = next;
    onStatus(next);
  }

  function resetEpisode() {
    streak = 0;
    lastCand = null;
    clicks = 0;
  }

  /** Кадр клиентской области окна: { data(BGRA), width, height, rect } либо null. */
  async function captureWindow(rect) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const display = screen.getDisplayNearestPoint(screen.screenToDipPoint({ x: cx, y: cy }));
    const origin = screen.dipToScreenPoint({ x: display.bounds.x, y: display.bounds.y });
    const dispW = Math.round(display.bounds.width * display.scaleFactor);
    const dispH = Math.round(display.bounds.height * display.scaleFactor);

    const scale = Math.min(1, FRAME_WIDTH / rect.width);
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(dispW * scale), height: Math.round(dispH * scale) },
    });
    const src = sources.find((s) => s.display_id === String(display.id)) || sources[0];
    if (!src || src.thumbnail.isEmpty()) return null;

    const { width: tw, height: th } = src.thumbnail.getSize();
    const bmp = src.thumbnail.toBitmap();

    const sx = tw / dispW;
    const sy = th / dispH;
    const left = Math.max(0, Math.round((rect.x - origin.x) * sx));
    const top = Math.max(0, Math.round((rect.y - origin.y) * sy));
    const right = Math.min(tw, Math.round((rect.x + rect.width - origin.x) * sx));
    const bottom = Math.min(th, Math.round((rect.y + rect.height - origin.y) * sy));
    const w = right - left;
    const h = bottom - top;
    if (w < 64 || h < 64) return null;

    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const from = ((top + y) * tw + left) * 4;
      data.set(bmp.subarray(from, from + w * 4), y * w * 4);
    }
    return { data, width: w, height: h };
  }

  function saveDebug(frame, cand) {
    try {
      const dir = path.join(app.getPath("userData"), "debug");
      fs.mkdirSync(dir, { recursive: true });
      const data = Buffer.from(frame.data);
      const put = (x, y) => {
        const i = (y * frame.width + x) * 4;
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 255; data[i + 3] = 255;
      };
      for (let x = cand.x; x < cand.x + cand.width; x++) { put(x, cand.y); put(x, cand.y + cand.height - 1); }
      for (let y = cand.y; y < cand.y + cand.height; y++) { put(cand.x, y); put(cand.x + cand.width - 1, y); }
      const png = nativeImage.createFromBitmap(data, { width: frame.width, height: frame.height }).toPNG();
      fs.writeFileSync(path.join(dir, `accept-${Date.now()}.png`), png);
    } catch (_) {
      /* debug only */
    }
  }

  async function accept(hwnd, rect, frame, cand) {
    // Не кликаем «вслепую» в чужое окно: Dota должна быть на переднем плане
    if (!win32.isForeground(hwnd)) {
      const ok = await win32.bringToForeground(hwnd);
      if (!ok) return;
      return; // позиция могла сместиться — перехватим на следующем кадре
    }
    const px = rect.x + (cand.cx / frame.width) * rect.width;
    const py = rect.y + (cand.cy / frame.height) * rect.height;
    if (DEBUG) saveDebug(frame, cand);
    await win32.clickAt(px, py);
    clicks++;
    lastClickAt = Date.now();
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const hwnd = win32.findDotaWindow();
      if (!hwnd) {
        resetEpisode();
        return setStatus("no-dota");
      }
      const rect = win32.getClientRectOnScreen(hwnd);
      if (!rect) {
        resetEpisode();
        return setStatus("minimized");
      }
      const frame = await captureWindow(rect);
      if (!frame) return;

      const cand = findAcceptButton(frame);

      if (!cand) {
        goneStreak++;
        if (goneStreak >= GONE_FRAMES) {
          if (clicks > 0) setStatus("accepted");
          else setStatus("watching");
          resetEpisode();
        }
        return;
      }
      goneStreak = 0;

      const same =
        lastCand &&
        Math.abs(cand.cx - lastCand.cx) < frame.width * 0.03 &&
        Math.abs(cand.cy - lastCand.cy) < frame.height * 0.03;
      streak = same ? streak + 1 : 1;
      lastCand = cand;
      if (streak < CONFIRM_FRAMES) return;
      if (clicks >= MAX_CLICKS) return;
      if (Date.now() - lastClickAt < RETRY_MS) return;

      setStatus("accepting");
      await accept(hwnd, rect, frame, cand);
    } catch (err) {
      console.error("[accept-worker]", err);
    } finally {
      busy = false;
    }
  }

  return {
    start() {
      if (timer) return;
      goneStreak = 0;
      resetEpisode();
      setStatus("watching");
      timer = setInterval(tick, TICK_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      setStatus("idle");
    },
    isRunning: () => Boolean(timer),
  };
}

module.exports = { createAcceptWorker };
