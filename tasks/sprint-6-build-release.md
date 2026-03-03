---
sprint: S6
title: Build & Release
weeks: 12-13
status: Todo
skill_refs:
  - skills/10-cross-platform-build/SKILL.md
depends_on: S5
---

# Sprint 6 — Build & Release

> Mục tiêu: Build release binaries cho Windows và macOS, đo metrics, smoke test final, tag v0.1.0.  
> Sau sprint này: MVP 0.1.0 đã ship.

---

## Task 6.1 — App Icon

**File**: `assets/icon.png`

- [ ] Tạo thư mục `assets/`
- [ ] Tạo hoặc lấy icon PNG **512×512** (hoặc tối thiểu 256×256)
  - Format: PNG với transparent background
  - Content: logo Zentro hoặc placeholder icon đơn giản
- [ ] Verify file tồn tại: `assets/icon.png`

**Done khi**: file icon PNG tồn tại đúng path.

---

## Task 6.2 — Embed Icon vào Binary

**File**: `cmd/zentro/bundled.go` (auto-generated)

- [ ] Cài `fyne` tool nếu chưa có:
  ```bash
  go install fyne.io/fyne/v2/cmd/fyne@latest
  ```
- [ ] Bundle icon:
  ```bash
  fyne bundle -o cmd/zentro/bundled.go assets/icon.png
  ```
  → Tạo ra file `cmd/zentro/bundled.go` với `resourceIconPng`

- [ ] Trong `main.go`, thêm:
  ```go
  app.SetIcon(resourceIconPng)
  ```

- [ ] Verify: `go build ./...` pass (bundled.go được compile cùng)

**Done khi**: icon embed vào binary, không cần file ngoài.

---

## Task 6.3 — Windows Release Build

**Environment**: Windows với CGO enabled (MinGW-w64 hoặc TDM-GCC)

- [ ] Verify CGO environment:
  ```powershell
  $env:CGO_ENABLED=1
  gcc --version   # phải có output
  ```

- [ ] Development build kiểm tra (có console):
  ```powershell
  go build -o zentro-debug.exe ./cmd/zentro/
  .\zentro-debug.exe   # kiểm tra chạy đúng
  ```

- [ ] Release build (không có console window):
  ```powershell
  go build -ldflags="-s -w -H windowsgui" -o zentro.exe ./cmd/zentro/
  ```

- [ ] Kiểm tra binary:
  - [ ] File tồn tại: `zentro.exe`
  - [ ] Size < 30MB: `(Get-Item zentro.exe).Length / 1MB`
  - [ ] Chạy được bằng double-click, không có console window

**Done khi**: `zentro.exe` < 30MB, chạy được, không có console.

---

## Task 6.4 — macOS Release Build

**Option A** — Native build trên macOS machine:

```bash
# arm64 (Apple Silicon)
CGO_ENABLED=1 GOARCH=arm64 GOOS=darwin \
  go build -ldflags="-s -w" -o zentro-arm64 ./cmd/zentro/

# amd64 (Intel Mac)
CGO_ENABLED=1 GOARCH=amd64 GOOS=darwin \
  go build -ldflags="-s -w" -o zentro-amd64 ./cmd/zentro/

# Universal binary
lipo -create -output zentro zentro-arm64 zentro-amd64
```

**Option B** — Cross-compile từ Windows dùng fyne-cross + Docker:

```powershell
# Cài fyne-cross
go install github.com/fyne-io/fyne-cross@latest

# Build (cần Docker đang chạy)
fyne-cross darwin -arch=amd64,arm64 -app-id=io.zentro.app -name=Zentro ./cmd/zentro/
```

- [ ] Binary size < 30MB
- [ ] Test chạy được trên macOS (nếu có máy)

**Done khi**: binary macOS tồn tại, đúng size.

---

## Task 6.5 — fyne package (Optional — App Bundle)

> Tùy chọn: tạo `.app` bundle cho macOS hoặc installer cho Windows.

```bash
# macOS .app bundle
fyne package -os darwin -icon assets/icon.png \
  -name "Zentro" -appID "io.zentro.app" \
  --app-version "0.1.0"

# Windows (tạo .exe với icon embedded đúng chuẩn Windows)
fyne package -os windows -icon assets/icon.png \
  -name "Zentro" -appID "io.zentro.app" \
  --app-version "0.1.0"
```

- [ ] Nếu dùng fyne package: verify icon xuất hiện đúng trên taskbar/dock
- [ ] Nếu không: dùng `zentro.exe` từ Task 6.3 là đủ cho MVP

---

## Task 6.6 — Performance Validation

Thực hiện đo trên **máy build chính** (Windows):

### Startup time

```powershell
# Đo cold start time
Measure-Command { Start-Process zentro.exe -Wait } | Select-Object TotalSeconds
```

- [ ] Startup < 1 giây (cold start)
- [ ] Nếu > 1s: kiểm tra có import nặng nào không cần thiết ở init

### RAM Usage idle

```powershell
# Sau khi app mở, đợi 30s, đo RAM
$proc = Get-Process zentro
$ramMB = $proc.WorkingSet64 / 1MB
Write-Host "RAM: $ramMB MB"
```

- [ ] RAM idle < 100 MB

### Binary size

```powershell
$sizeMB = (Get-Item zentro.exe).Length / 1MB
Write-Host "Size: $sizeMB MB"
```

- [ ] Size < 30 MB

**Done khi**: tất cả 3 metrics pass.

---

## Task 6.7 — Final Smoke Test (Full Flow)

Test end-to-end trên binary đã build (không phải `go run`):

**Setup**: cần access đến PostgreSQL instance thật.

- [ ] Double-click `zentro.exe` → app mở, không crash
- [ ] App icon đúng trong taskbar
- [ ] Title bar: "Zentro"
- [ ] **Connection flow**:
  - Tạo connection profile → Test Connection → thành công
  - Save → profile persistent sau restart
  - Double-click profile → kết nối → status bar cập nhật
- [ ] **Query flow**:
  - "New Query" → tab mới
  - Gõ `SELECT version()` → Ctrl+Enter → result xuất hiện
  - Duration và row count đúng trong status bar
- [ ] **Edit flow**:
  - Chạy `SELECT * FROM <table>` với vài rows
  - Double-click cell → edit → Apply
  - Edited cell hiển thị italic
- [ ] **Batch Edit flow**:
  - Click 3 cells cùng cột
  - Double-click một → nhập giá trị → batch confirm
  - Tất cả 3 cells cập nhật
- [ ] **Export flow**:
  - Click "Export CSV" → chọn path → Export
  - Mở file CSV → đúng data với edited values
- [ ] **History flow**:
  - Chạy 3 queries khác nhau
  - Mở history panel → 3 entries
  - Click entry → query paste vào editor
- [ ] **Settings flow**:
  - Settings → Dark theme → Apply → UI dark mode
  - Restart app → vẫn dark mode
  - Settings → Default Limit = 10 → chạy query lớn → chỉ 10 rows

**Done khi**: tất cả test cases pass.

---

## Task 6.8 — Git Tag & Release

- [ ] Commit tất cả changes:
  ```bash
  git add -A
  git commit -m "chore: MVP 0.1.0 release"
  ```
- [ ] Tag:
  ```bash
  git tag -a v0.1.0 -m "Zentro MVP v0.1.0"
  git push origin main --tags
  ```
- [ ] Tạo GitHub Release (nếu có):
  - Upload `zentro.exe` (Windows)
  - Upload `zentro` hoặc `Zentro.app` (macOS)
  - Release notes liệt kê features MVP

**Done khi**: tag v0.1.0 tồn tại trên remote, binaries đính kèm.

---

## Release Checklist Tổng Thể

- [ ] `go build ./...` clean không error trên Windows
- [ ] `go vet ./...` không warning
- [ ] `app.NewWithID("io.zentro.app")` — đã dùng đúng App ID
- [ ] Icon bundle đúng trong binary
- [ ] Windows binary: không có console window, đúng icon, size < 30MB, startup < 1s
- [ ] RAM idle < 100MB
- [ ] Tất cả S1–S5 acceptance criteria đã pass
- [ ] Full smoke test pass
- [ ] git tag v0.1.0 pushed
