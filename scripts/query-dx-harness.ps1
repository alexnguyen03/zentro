param (
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"

Write-Host "== Query DX Benchmark/Soak Harness ==" -ForegroundColor Cyan

Write-Host "[1/4] Go benchmark: internal/db" -ForegroundColor Yellow
go test ./internal/db -bench Benchmark -benchmem -run ^$
if ($LASTEXITCODE -ne 0) { throw "Go benchmark failed: internal/db" }

Write-Host "[2/4] Go benchmark: internal/app" -ForegroundColor Yellow
go test ./internal/app -bench Benchmark -benchmem -run ^$
if ($LASTEXITCODE -ne 0) { throw "Go benchmark failed: internal/app" }

if (-not $SkipFrontend) {
    Write-Host "[3/4] Frontend soak tests" -ForegroundColor Yellow
    cmd /c "cd frontend && npx vitest run src/stores/resultStore.soak.test.ts"
    if ($LASTEXITCODE -ne 0) { throw "Frontend soak test failed" }
} else {
    Write-Host "[3/4] Frontend soak tests skipped" -ForegroundColor DarkYellow
}

Write-Host "[4/4] Baseline smoke" -ForegroundColor Yellow
go test ./internal/app ./internal/db
if ($LASTEXITCODE -ne 0) { throw "Baseline smoke failed" }

Write-Host "Harness complete." -ForegroundColor Green
