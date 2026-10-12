"use strict";

/**
 * Поиск зелёной кнопки «ПРИНЯТЬ» на кадре. Чистая функция, без Electron/WinAPI.
 *
 * Не привязан к координатам: ищем сплошное зелёное прямоугольное пятно подходящего
 * размера (относительно кадра) в центральной части. Поэтому одинаково работает на
 * любом разрешении и с Dota+ (там кнопка смещена выше).
 *
 * Кадр: { data: Uint8Array BGRA, width, height }.
 */

const DEFAULTS = {
  // Цвет кнопки в HSV: hue в градусах, s/v в 0..1
  hueMin: 80,
  hueMax: 155,
  satMin: 0.45,
  valMin: 0.35,
  // Зона поиска (доли кадра)
  zone: { x0: 0.2, x1: 0.8, y0: 0.1, y1: 0.9 },
  // Размеры кнопки (доли ширины/высоты кадра)
  minWidthFrac: 0.05,
  maxWidthFrac: 0.3,
  minHeightFrac: 0.025,
  maxHeightFrac: 0.14,
  // Ширина / высота
  minAspect: 2.0,
  maxAspect: 8.0,
  // Доля зелёных пикселей внутри рамки (текст «ПРИНЯТЬ» вырезает часть)
  minFill: 0.55,
  // Кнопка должна быть примерно по центру экрана по горизонтали
  centerTolerance: 0.15,
};

function isGreen(b, g, r, c) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return false;
  const v = max / 255;
  const s = (max - min) / max;
  if (v < c.valMin || s < c.satMin) return false;
  let h;
  const d = max - min;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h >= c.hueMin && h <= c.hueMax;
}

/**
 * @returns {{x,y,width,height,cx,cy,fill}|null} лучший кандидат в координатах кадра
 */
function findAcceptButton(frame, options) {
  const c = { ...DEFAULTS, ...options };
  const { data, width: W, height: H } = frame;
  const x0 = Math.floor(W * c.zone.x0);
  const x1 = Math.ceil(W * c.zone.x1);
  const y0 = Math.floor(H * c.zone.y0);
  const y1 = Math.ceil(H * c.zone.y1);
  const zw = x1 - x0;
  const zh = y1 - y0;

  const mask = new Uint8Array(zw * zh);
  for (let y = 0; y < zh; y++) {
    let i = ((y0 + y) * W + x0) * 4;
    for (let x = 0; x < zw; x++, i += 4) {
      if (isGreen(data[i], data[i + 1], data[i + 2], c)) mask[y * zw + x] = 1;
    }
  }

  const visited = new Uint8Array(zw * zh);
  const stack = [];
  let best = null;

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;

    let minX = zw, maxX = 0, minY = zh, maxY = 0, count = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      const px = p % zw;
      const py = (p - px) / zw;
      count++;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      // 4-связность
      if (px > 0 && mask[p - 1] && !visited[p - 1]) { visited[p - 1] = 1; stack.push(p - 1); }
      if (px < zw - 1 && mask[p + 1] && !visited[p + 1]) { visited[p + 1] = 1; stack.push(p + 1); }
      if (py > 0 && mask[p - zw] && !visited[p - zw]) { visited[p - zw] = 1; stack.push(p - zw); }
      if (py < zh - 1 && mask[p + zw] && !visited[p + zw]) { visited[p + zw] = 1; stack.push(p + zw); }
    }

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const wf = w / W;
    const hf = h / H;
    if (wf < c.minWidthFrac || wf > c.maxWidthFrac) continue;
    if (hf < c.minHeightFrac || hf > c.maxHeightFrac) continue;
    const aspect = w / h;
    if (aspect < c.minAspect || aspect > c.maxAspect) continue;
    const fill = count / (w * h);
    if (fill < c.minFill) continue;

    const cx = x0 + minX + w / 2;
    const cy = y0 + minY + h / 2;
    if (Math.abs(cx / W - 0.5) > c.centerTolerance) continue;

    const cand = { x: x0 + minX, y: y0 + minY, width: w, height: h, cx, cy, fill };
    // Среди подходящих берём самую крупную
    if (!best || w * h > best.width * best.height) best = cand;
  }

  return best;
}

module.exports = { findAcceptButton, DEFAULTS };
