"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIcoMod = require("png-to-ico");
const pngToIco = typeof pngToIcoMod === "function" ? pngToIcoMod : pngToIcoMod.default;

const root = path.join(__dirname, "..");
const src = path.join(root, "public", "brand.png");
const outPng = path.join(root, "public", "brand.png");
const outIco = path.join(root, "build", "icon.ico");
const outIcoPublic = path.join(root, "public", "icon.ico");

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  h /= 360;
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

async function recolorToOrange(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 8) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    // green / teal / emerald → ярко-рыжий (#FF5A00-ish)
    if (h >= 70 && h <= 185 && s > 0.08) {
      const nh = 18; // ярко-рыжий
      const ns = Math.min(1, Math.max(0.85, s * 1.35 + 0.25));
      const nl = Math.min(0.62, Math.max(0.38, l * 0.95 + 0.12));
      const [nr, ng, nb] = hslToRgb(nh, ns, nl);
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    } else if (s < 0.12 && l > 0.35 && l < 0.9 && a > 40) {
      // холодные серые блики центра → тёплый рыжий блик
      const [nr, ng, nb] = hslToRgb(22, 0.55, Math.min(0.78, l + 0.08));
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();
}

async function main() {
  fs.mkdirSync(path.join(root, "build"), { recursive: true });

  // backup original once
  const backup = path.join(root, "public", "brand-green.png");
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(src, backup);
  }

  const source = fs.existsSync(backup) ? backup : src;
  const orange = await recolorToOrange(source);
  await orange.toFile(outPng);

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  for (const size of sizes) {
    const buf = await sharp(outPng)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push(buf);
  }

  const ico = await pngToIco(pngBuffers);
  fs.writeFileSync(outIco, ico);
  fs.writeFileSync(outIcoPublic, ico);

  console.log("Recolored brand.png + icon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
