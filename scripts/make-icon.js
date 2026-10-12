"use strict";

// Рендерит public/logo.svg (рыжий контур) с рыжим свечением -> public/brand.png, build/icon.ico, public/icon.ico

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIcoMod = require("png-to-ico");
const pngToIco = typeof pngToIcoMod === "function" ? pngToIcoMod : pngToIcoMod.default;

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public", "logo.svg");
const outPng = path.join(root, "public", "brand.png");
const outIco = path.join(root, "build", "icon.ico");
const outIcoPublic = path.join(root, "public", "icon.ico");

const SIZE = 512;
// Знак занимает ~88% холста по высоте — как в иконках Largo Auto Config / Rent Bot
const LOGO = 500;
const GLOW = "#ff6a00";

async function render() {
  const svg = fs.readFileSync(svgPath);
  const logo = await sharp(svg, { density: 1200 }).resize(LOGO, LOGO).png().toBuffer();
  const pad = (SIZE - LOGO) / 2;
  const place = (buf) => sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: buf, left: pad, top: pad }]).png().toBuffer();
  const base = await place(logo);

  // свечение: тот же знак, перекрашенный в рыжий и размытый (два радиуса)
  const tint = (buf) => sharp(buf).tint(GLOW).toBuffer();
  const tinted = await tint(base);
  const wide = await sharp(tinted).blur(12).linear(1.6, 0).toBuffer();
  const tight = await sharp(tinted).blur(5).linear(1.3, 0).toBuffer();

  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: wide }, { input: tight }, { input: base }])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(path.join(root, "build"), { recursive: true });
  const png = await render();
  fs.writeFileSync(outPng, png);

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = [];
  for (const size of sizes) {
    buffers.push(await sharp(png).resize(size, size, { fit: "contain" }).png().toBuffer());
  }
  const ico = await pngToIco(buffers);
  fs.writeFileSync(outIco, ico);
  fs.writeFileSync(outIcoPublic, ico);
  console.log("OK: brand.png + icon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
