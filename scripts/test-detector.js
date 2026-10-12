"use strict";
// Синтетическая проверка детектора: node scripts/test-detector.js
const assert = require("assert");
const { findAcceptButton } = require("../electron/detector");

function frame(W, H) {
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 30; data[i + 1] = 28; data[i + 2] = 26; data[i + 3] = 255; }
  return { data, width: W, height: H };
}
function rect(f, x, y, w, h, [r, g, b]) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    const k = (j * f.width + i) * 4; f.data[k] = b; f.data[k + 1] = g; f.data[k + 2] = r;
  }
}
// кнопка с «текстом» (белые полоски внутри) и градиентом
function button(f, cx, cy, w, h) {
  const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  for (let j = 0; j < h; j++) rect(f, x, y + j, w, 1, [70 + Math.round(30 * j / h), 170 - Math.round(30 * j / h), 50]);
  rect(f, x + w * 0.3, y + h * 0.35, w * 0.4, h * 0.3, [240, 240, 240]);
  return { x, y };
}

let n = 0;
for (const [W, H] of [[1280, 720], [1920, 1080], [2560, 1440], [960, 540]]) {
  for (const yFrac of [0.52, 0.45]) { // обычная и Dota+ (выше)
    const f = frame(W, H);
    rect(f, W * 0.02, H * 0.9, W * 0.12, H * 0.05, [90, 190, 70]); // «Play Dota» не по центру
    rect(f, W * 0.48, H * 0.2, W * 0.02, W * 0.02, [90, 190, 70]); // мелкая иконка
    button(f, W / 2, H * yFrac, W * 0.13, H * 0.05);
    const c = findAcceptButton(f);
    assert(c, `не найдена ${W}x${H} y=${yFrac}`);
    assert(Math.abs(c.cx - W / 2) < W * 0.01 && Math.abs(c.cy - H * yFrac) < H * 0.01, `смещение ${W}x${H}`);
    n++;
  }
}
const empty = frame(1920, 1080);
rect(empty, 100, 900, 300, 60, [90, 190, 70]);
assert.strictEqual(findAcceptButton(empty), null, "ложное срабатывание");
const red = frame(1920, 1080);
button(red, 960, 560, 250, 54); // зелёная кнопка есть → найдётся
rect(red, 835, 533, 250, 54, [200, 60, 50]); // перекрасим в красный → не должна
assert.strictEqual(findAcceptButton(red), null, "красная кнопка принята за зелёную");
console.log(`OK (${n} сцен + 2 негативных)`);
