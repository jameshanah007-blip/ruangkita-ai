param(
    [Parameter(Mandatory=$true)]
    [string]$Message
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== RUANGKITA AI - SAVE PROJECT ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Checking Git status..." -ForegroundColor Yellow
git status --short

$changes = git status --porcelain

if (-not $changes) {
    Write-Host ""
    Write-Host "Tidak ada perubahan untuk di-commit." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "[2/4] Adding changes..." -ForegroundColor Yellow
git add .

Write-Host ""
Write-Host "[3/4] Creating commit..." -ForegroundColor Yellow
git commit -m $Message

Write-Host ""
Write-Host "[4/4] Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "PROJECT BERHASIL DISIMPAN KE GITHUB" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""