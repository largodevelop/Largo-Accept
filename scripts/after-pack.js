"use strict";

// electron-builder afterPack: вшиваем иконку в exe (signAndEditExecutable выключен,
// поэтому штатный rcedit не запускается).
const path = require("path");

module.exports = async function afterPack(context) {
  const { rcedit } = await import("rcedit");
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const ico = path.join(context.packager.projectDir, "build", "icon.ico");
  const version = context.packager.appInfo.version;
  // Свойства файла (издатель, версия, описание): без них Защитник чаще считает неподписанный exe подозрительным.
  await rcedit(exe, {
    icon: ico,
    "file-version": version,
    "product-version": version,
    "version-string": {
      CompanyName: "Largo Develop",
      FileDescription: "Largo Accept: автопринятие матча Dota 2",
      ProductName: "Largo Accept",
      InternalName: "Largo Accept",
      OriginalFilename: "Largo Accept.exe",
      LegalCopyright: "Largo Develop, MIT License",
    },
  });
  console.log("  • icon and version info embedded into", path.basename(exe));
};
