### Specification 10: Cross-Platform Build & Packaging

**Mô tả**: Build standalone binaries cho Windows và macOS sử dụng Wails CLI.

**Thay thế**: `fyne-cross` → `wails build`. Không cần Docker.

**Build Commands**:
```powershell
# Windows (amd64) — chạy trên Windows host
wails build -platform windows/amd64 -o zentro.exe

# macOS (amd64) — chạy trên macOS host
wails build -platform darwin/amd64 -o zentro-mac

# macOS (arm64/Apple Silicon)
wails build -platform darwin/arm64 -o zentro-mac-arm64
```

**Frontend build** được tự động bundled vào binary qua `//go:embed all:frontend/dist`.

**WebView Requirements**:
| Platform | WebView | Bundled? |
|---|---|---|
| Windows | WebView2 (Chromium-based) | Cần WebView2 Runtime installed; hoặc dùng `-windowsConsole` + embedded |
| macOS | WebKit (built-in) | ✅ Có sẵn trong OS |

**Windows WebView2 Strategy**:
- Option 1 (MVP): Yêu cầu user cài [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) — thường đã có sẵn trên Win10/11.
- Option 2 (post-MVP): Bundle Evergreen bootstrapper vào installer (NSIS/WiX).

**Output**:
- Windows: `zentro.exe` + `zentro.exe.manifest`
- macOS: `zentro.app` bundle (tự động bởi Wails)

**Binary Size Expectation**:
- ~10–20MB frontend assets (bundled Vite output, Monaco Editor minified).
- ~15–20MB Go binary.
- **Total: ~30–40MB** — chấp nhận được với WebView approach.

> ⚠️ Monaco Editor bundle to lớn (~4MB minified + gzipped). Dùng `vite-plugin-monaco-editor` để tree-shake, chỉ load SQL worker.

**Build Script** (`run.ps1` — cập nhật):
```powershell
# Dev mode (hot reload cả Go + React)
wails dev

# Production build
wails build -clean -platform windows/amd64
```

**Sprint Planning**: **Phase 5** (sau khi toàn bộ features hoàn chỉnh).
