# Copy niko-miao PetDex files into Codex's local pets folder.
# Usage (from repo root, PowerShell):
#   powershell -ExecutionPolicy Bypass -File petdex\install-to-codex.ps1

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcDir = Join-Path $scriptDir "niko-miao"
$destDir = Join-Path $env:USERPROFILE ".codex\pets\niko-miao"

$petJson = Join-Path $srcDir "pet.json"
$sheet = Join-Path $srcDir "spritesheet.webp"

if (-not (Test-Path $petJson)) {
    throw "Missing $petJson. Run this from a checkout that contains petdex/niko-miao/."
}
if (-not (Test-Path $sheet)) {
    throw "Missing $sheet."
}

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item $petJson (Join-Path $destDir "pet.json") -Force
Copy-Item $sheet (Join-Path $destDir "spritesheet.webp") -Force

Write-Host "Installed:"
Get-ChildItem $destDir | ForEach-Object { Write-Host ("  " + $_.FullName) }
Write-Host ""
Write-Host "Next: reopen the pet importer and pick 尼古喵喵."
