"use strict";

// electron-builder afterPack: вшиваем иконку в exe (signAndEditExecutable выключен,
// поэтому штатный rcedit не запускается).
const path = require("path");

module.exports = async function afterPack(context) {
  const { rcedit } = await import("rcedit");
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const ico = path.join(context.packager.projectDir, "build", "icon.ico");
  await rcedit(exe, { icon: ico });
  console.log("  • icon embedded into", path.basename(exe));
};
