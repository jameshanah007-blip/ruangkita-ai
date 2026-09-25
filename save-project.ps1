param(
    [Parameter(Mandatory=$true)]
    [string]$Message
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== RUANGKITA AI - SAVE PROJECT ===" -ForegroundColor Cyan
Write-Host ""

# Make sure we are inside a Git repository
git rev-parse --is-inside-work-tree *> $null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Folder ini bukan Git repository." -ForegroundColor Red
    exit 1
}

# Make sure we are on main
$branch = git branch --show-current

if ($branch -ne "main") {
    Write-Host "ERROR: Anda tidak sedang berada di branch main." -ForegroundColor Red
    Write-Host "Branch saat ini: $branch" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/5] Checking local changes..." -ForegroundColor Yellow

$changes = git status --porcelain

if (-not $changes) {
    Write-Host ""
    Write-Host "Tidak ada perubahan untuk di-commit." -ForegroundColor Green
    exit 0
}

# Check GitHub before committing
Write-Host "[2/5] Checking GitHub for newer changes..." -ForegroundColor Yellow

git fetch origin main

$behind = git rev-list --count HEAD..origin/main

if ([int]$behind -gt 0) {
    Write-Host ""
    Write-Host "PERINGATAN: GitHub memiliki perubahan yang belum ada di komputer ini." -ForegroundColor Red
    Write-Host "Jumlah commit yang tertinggal: $behind" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Jangan push dulu." -ForegroundColor Red
    Write-Host "Jalankan: git pull origin main" -ForegroundColor Cyan
    Write-Host "Jika terjadi conflict, selesaikan conflict terlebih dahulu." -ForegroundColor Cyan
    exit 1
}

Write-Host "[3/5] Adding changes..." -ForegroundColor Yellow
git add .

Write-Host "[4/5] Creating commit..." -ForegroundColor Yellow
git commit -m $Message

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Commit gagal." -ForegroundColor Red
    exit 1
}

Write-Host "[5/5] Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Push gagal. Commit lokal tetap tersimpan." -ForegroundColor Red
    Write-Host "Jangan membuat commit ulang. Periksa GitHub dan jalankan git status." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "PROJECT BERHASIL DISIMPAN KE GITHUB" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""