---
name: zentro-cross-platform-build
description: >
  Hướng dẫn build binary Zentro cho Windows và macOS, bao gồm CGO requirements,
  fyne package command, fyne-cross cho cross-compilation, size optimization flags,
  và checklist trước khi release.
---

# Skill 10: Cross-Platform Build & Packaging

## App ID (bắt buộc set trong main.go)

```go
// cmd/zentro/main.go
app := app.NewWithID("io.zentro.app")
```

App ID phải nhất quán ở mọi nơi — dùng cho Fyne Preferences storage và app bundle metadata.

## Build Requirements

| Platform | Requirement |
|---|---|
| Windows (native) | Go, CGO enabled, GCC (MSYS2 MinGW hoặc TDM-GCC) |
| macOS (native) | Go, Xcode Command Line Tools |
| Cross-build Win → Mac | Docker + fyne-cross |
| Cross-build Mac → Win | Docker + fyne-cross |

### Cài MSYS2 GCC trên Windows (nếu chưa có)

```powershell
# Cài MSYS2, sau đó trong MSYS2 terminal:
pacman -S mingw-w64-x86_64-gcc
# Thêm C:\msys64\mingw64\bin vào PATH
```

## Build Commands

### Windows — native build

```powershell
# Development build (có debug symbols)
$env:CGO_ENABLED=1
go build -o zentro.exe ./cmd/zentro/

# Release build (stripped, no console window)
go build -ldflags="-s -w -H windowsgui" -o zentro.exe ./cmd/zentro/
```

### macOS — native build

```bash
# Development
CGO_ENABLED=1 go build -o zentro ./cmd/zentro/

# Release (universal binary arm64+amd64)
CGO_ENABLED=1 GOARCH=arm64 go build -ldflags="-s -w" -o zentro-arm64 ./cmd/zentro/
CGO_ENABLED=1 GOARCH=amd64 go build -ldflags="-s -w" -o zentro-amd64 ./cmd/zentro/
lipo -create -output zentro zentro-arm64 zentro-amd64
```

### Fyne package (tạo app bundle / installer)

```bash
# Cài fyne tool
go install fyne.io/fyne/v2/cmd/fyne@latest

# Windows (.exe + resource embedding)
fyne package -os windows -icon assets/icon.png -name "Zentro" -appID "io.zentro.app"

# macOS (.app bundle)
fyne package -os darwin -icon assets/icon.png -name "Zentro" -appID "io.zentro.app"
```

### Cross-platform build với fyne-cross

```bash
# Cài fyne-cross
go install github.com/fyne-io/fyne-cross@latest

# Build cho macOS từ Windows (cần Docker)
fyne-cross darwin -arch=amd64,arm64 -app-id=io.zentro.app -name=Zentro ./cmd/zentro/

# Build cho Windows từ macOS (cần Docker)
fyne-cross windows -arch=amd64 -app-id=io.zentro.app -name=Zentro ./cmd/zentro/
```

## Size Optimization

| Technique | Tác động |
|---|---|
| `-ldflags="-s -w"` | Xóa debug symbols → giảm ~25–35% |
| `-H windowsgui` (Windows only) | Ẩn console window khi chạy |
| `fyne bundle` icon | Embed icon vào binary, không cần file ngoài |
| Tránh import package không dùng | Giảm binary size |

> Target: binary < 30MB sau khi strip. Thường đạt được với Go + Fyne mà không cần UPX.

## Icon Requirements

```
assets/
└── icon.png   // 256×256 hoặc 512×512, PNG
```

- macOS: fyne tự tạo `.icns` từ PNG
- Windows: fyne tự tạo `.ico` từ PNG
- Không cần tự convert thủ công

## Release Checklist

- [ ] App ID đã set: `app.NewWithID("io.zentro.app")`
- [ ] Version đã set trong `fyne package --app-version 0.1.0`
- [ ] Icon đúng kích thước (256×256 minimum)
- [ ] Test chạy trên cả Windows và macOS trước release
- [ ] Build với `-ldflags="-s -w"` (không `-race`)
- [ ] Binary size kiểm tra < 30MB
- [ ] Startup time kiểm tra < 1 giây (cold start)

## CI/CD Gợi ý (post-MVP)

```yaml
# GitHub Actions — chỉ native build, không cross-compile trong MVP
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - run: go build -ldflags="-s -w -H windowsgui" -o zentro.exe ./cmd/zentro/

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - run: CGO_ENABLED=1 go build -ldflags="-s -w" -o zentro ./cmd/zentro/
```
