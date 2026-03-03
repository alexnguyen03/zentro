# Script để chạy ứng dụng mà không bị lỗi block ở Temp folder
$exeName = "zentro.exe"

# 1. Kill tiến trình cũ nếu nó đang chạy (tránh lỗi file đang bị khoá)
$process = Get-Process -Name "zentro" -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "Stopping running instance..." -ForegroundColor Yellow
    Stop-Process -Name "zentro" -Force
    Start-Sleep -Seconds 1
}

# 2. Build file exe vào thư mục hiện tại (thay vì Temp)
Write-Host "Building Zentro..." -ForegroundColor Cyan
go build -o $exeName ./cmd/zentro/

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Chạy file exe vừa build
Write-Host "Starting Zentro..." -ForegroundColor Green
./$exeName
