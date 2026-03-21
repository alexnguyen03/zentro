param (
    [switch]$NoInstaller
)

$platforms = @(
    "windows/amd64",
    "darwin/universal",
    "linux/amd64"
)

foreach ($platform in $platforms) {
    Write-Host "Building $platform..." -ForegroundColor Cyan

    $args = @(
        "build",
        "-clean",
        "-platform", $platform,
        "-ldflags", "-X 'zentro/internal/app.Version=v0.2.0-beta'"
    )

    if ($platform -eq "windows/amd64" -and -not $NoInstaller) {
        $args += "-nsis"
    }

    wails @args
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed for $platform with exit code $LASTEXITCODE"
    }
}

Write-Host "Release matrix build complete." -ForegroundColor Green

