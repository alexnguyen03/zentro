# build_zentro.ps1
# Usage: 
#   .\build_zentro.ps1        (Production build with installer)
#   .\build_zentro.ps1 -Dev   (Dev build)
#   .\build_zentro.ps1 -NoInstaller (Build only exe, no installer)

param (
    [switch]$Dev,
    [switch]$NoInstaller
)

# Read version from wails.json
if (!(Test-Path "wails.json")) {
    Write-Host "Error: wails.json not found!" -ForegroundColor Red
    exit 1
}

$wailsJson = Get-Content -Raw "wails.json" | ConvertFrom-Json
$version = $wailsJson.info.productVersion

if (!$version) {
    Write-Host "Error: Could not find version in wails.json" -ForegroundColor Red
    exit 1
}

$suffix = if ($Dev) { "-dev" } else { "" }
$outputName = "zentro-v$version$suffix.exe"

Write-Host "--- Zentro Build Pipeline ---" -ForegroundColor Cyan
Write-Host "Version: $version"
Write-Host "Suffix:  $suffix"
Write-Host "Output:  $outputName"
Write-Host "Installer: $(-not $NoInstaller)"
Write-Host "-----------------------------"

# Build flags
$buildFlags = @(
    "build",
    "-clean",
    "-platform", "windows/amd64",
    "-ldflags", "-s -w -H windowsgui",
    "-o", $outputName
)

# Add NSIS installer if not disabled
if (-not $NoInstaller) {
    $buildFlags += "-nsis"
}

# Run wails build
wails @buildFlags

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: Build successful!" -ForegroundColor Green
    Write-Host "  Executable: build\bin\$outputName" -ForegroundColor Cyan
    if (-not $NoInstaller) {
        Write-Host "  Installer:  build\bin\zentro-v$version-setup.exe" -ForegroundColor Cyan
    }
} else {
    Write-Host "FAILED: Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
