$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$bundle = Join-Path $root "bundle\autoit"
$au3 = Join-Path $root "largo_accept.au3"
$outExe = Join-Path $bundle "largo_accept.exe"

New-Item -ItemType Directory -Force -Path $bundle | Out-Null

# clean old sound leftovers from previous builds
$sounds = Join-Path $bundle "sounds"
if (Test-Path $sounds) {
  Remove-Item $sounds -Recurse -Force
}
Get-ChildItem $bundle -Filter "*.au3" -ErrorAction SilentlyContinue | Remove-Item -Force

$aut2exeCandidates = @(
  "${env:ProgramFiles}\AutoIt3\Aut2exe\Aut2exe.exe",
  "${env:ProgramFiles(x86)}\AutoIt3\Aut2exe\Aut2exe.exe"
)
$aut2exe = $aut2exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $aut2exe) {
  throw "AutoIt Aut2exe not found. Install AutoIt."
}

$ico = Join-Path $root "build\icon.ico"
$iconArgs = @()
if (Test-Path $ico) {
  $iconArgs = @("/icon", $ico)
}

Write-Host "Compiling minimal largo_accept.au3"
& $aut2exe /in $au3 /out $outExe /nopack /x64 @iconArgs
if (-not (Test-Path $outExe)) {
  throw "Aut2exe did not produce largo_accept.exe"
}

Write-Host "OK: $outExe"
