$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Unpacked build starts much faster than portable (no extract every launch)
$exeCandidates = @(
  (Join-Path $root "release\win-unpacked\Largo Accept.exe"),
  (Join-Path $root "release\LargoAccept-1.0.0-portable.exe")
)
$exe = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$ico = Join-Path $root "build\icon.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "Largo Accept.lnk"

if (-not $exe) {
  throw "EXE not found. Run npm run build first."
}
if (-not (Test-Path $ico)) {
  throw "Icon not found. Run npm run prepare:brand first."
}

$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut($lnkPath)
$s.TargetPath = $exe
$s.WorkingDirectory = Split-Path $exe
$s.IconLocation = "$exe,0"
$s.Description = "Largo Accept"
$s.Save()

Write-Host "Shortcut: $lnkPath"
Write-Host "Target:   $exe"
