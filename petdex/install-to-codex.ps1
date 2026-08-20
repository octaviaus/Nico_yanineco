# Copy pet.json + spritesheet.webp into a destination folder.
# The destination is created if it does not exist (Copy-Item will not).
#
# Default dest: this repo's petdex\niko-miao
#   powershell -ExecutionPolicy Bypass -File petdex\install-to-codex.ps1
#
# Custom dest (example: local clone):
#   powershell -ExecutionPolicy Bypass -File petdex\install-to-codex.ps1 `
#     -Dest "C:\Users\zhouyuhan01\Nico_yanineco\petdex\niko-miao"
#
# Optional Codex pets folder:
#   powershell -ExecutionPolicy Bypass -File petdex\install-to-codex.ps1 `
#     -Dest "$env:USERPROFILE\.codex\pets\niko-miao"

param(
    [string]$Dest = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcDir = Join-Path $scriptDir "niko-miao"
if (-not $Dest) {
    $Dest = $srcDir
}

$petJson = Join-Path $srcDir "pet.json"
$sheet = Join-Path $srcDir "spritesheet.webp"

if (-not (Test-Path $petJson)) {
    throw "Missing $petJson. Run from a checkout that contains petdex\niko-miao\ (branch cursor/petdex-ref-sheet-854e)."
}
if (-not (Test-Path $sheet)) {
    throw "Missing $sheet."
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item $petJson (Join-Path $Dest "pet.json") -Force
Copy-Item $sheet (Join-Path $Dest "spritesheet.webp") -Force

Write-Host "Installed:"
Get-ChildItem $Dest -File | ForEach-Object { Write-Host ("  " + $_.FullName) }
Write-Host ""
Write-Host "Importer folder should contain pet.json + spritesheet.webp at the root (no extra nested niko-miao\)."
