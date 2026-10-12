"use strict";

const { execFile } = require("child_process");

const PS_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [StructLayout(LayoutKind.Sequential)] public struct RECT {
    public int Left; public int Top; public int Right; public int Bottom;
  }
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@
$procs = @('dota2','dota')
foreach ($name in $procs) {
  $p = Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($p) {
    $r = New-Object Win32+RECT
    [void][Win32]::GetWindowRect($p.MainWindowHandle, [ref]$r)
    if ($r.Right -gt $r.Left -and $r.Bottom -gt $r.Top) {
      Write-Output ("{0},{1},{2},{3}" -f $r.Left, $r.Top, ($r.Right - $r.Left), ($r.Bottom - $r.Top))
      exit 0
    }
  }
}
$w = Get-Process | Where-Object { $_.MainWindowTitle -match 'Dota 2' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($w) {
  $r = New-Object Win32+RECT
  [void][Win32]::GetWindowRect($w.MainWindowHandle, [ref]$r)
  Write-Output ("{0},{1},{2},{3}" -f $r.Left, $r.Top, ($r.Right - $r.Left), ($r.Bottom - $r.Top))
}
`;

function getDotaWindowRect() {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", PS_SCRIPT],
      { windowsHide: true, timeout: 4000 },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          resolve(null);
          return;
        }
        const parts = stdout.trim().split(",").map((n) => Number(n));
        if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
          resolve(null);
          return;
        }
        const [x, y, width, height] = parts;
        resolve({ x, y, width, height });
      }
    );
  });
}

module.exports = { getDotaWindowRect };
