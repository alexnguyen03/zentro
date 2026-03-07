# Zentro Tech-Debt & Issues Tracker

> Last updated: 2026-03-07

---

## Priority 1: Critical - Fix Immediately

### 1.1 TypeScript Errors in ResultTable.tsx

| Line | Issue | Fix |
|------|-------|-----|
| 131-144 | `isEditable` có thể là `undefined` - check logic cần guard | Add null check |
| 165 | `meta.editedCells.get()` có thể trả về `undefined` | Add fallback `\|\| ''` |
| 168 | Kiểm tra `isDirty` với giá trị có thể undefined | Add null check |
| 201 | Dependency array chưa đầy đủ cho `useMemo` | Add missing deps |

**Status**: ✅ DONE  
**Effort**: 1h

---

### 1.2 Unsafe Type Cast in App.tsx

| Line | Issue | Fix |
|------|-------|-----|
| 68 | `data.profile as any` - unsafe cast | Create proper type for connection event |

**Status**: ✅ DONE  
**Effort**: 30m

---

### 1.3 MSSQL Driver Not Registered

**Location**: `internal/core/registry.go`

**Issue**: Driver MSSQL đã import nhưng chưa được đăng ký trong registry, nên khi connect sẽ fail.

**Status**: ✅ DONE (already registered in main.go)  
**Effort**: 1h

---

## Priority 2: High - Fix Soon

### 2.1 Batch Edit - Missing Backend Call

**Location**: `frontend/src/components/editor/ResultTable.tsx`

**Issue**: Frontend có UI edit cells nhưng không có `ApplyEdits` gọi xuống backend để thực thi UPDATE query.

**Status**: ✅ DONE (ExecuteUpdateSync already exists and wired)  
**Effort**: 2h

---

### 2.2 Query Cancellation Race Condition

**Location**: `internal/app/app.go:414`

**Issue**: Khi cancel query, session không được xóa khỏi map ngay lập tức, có thể dẫn đến race condition.

**Status**: ✅ DONE (added delete in CancelQuery)  
**Effort**: 1h

---

### 2.3 Error Notification Gaps

**Issue**: Nhiều nơi log error nhưng không notify user đầy đủ (chỉ toast một số lỗi).

**Status**: ✅ DONE (added schema:error event)  
**Effort**: 2h

---

## Priority 3: Medium - Technical Debt

### 3.1 Global Mutable Variable - emitEvent

**Location**: `internal/app/app.go:26`

**Issue**: `var emitEvent = runtime.EventsEmit` - global mutable variable, khó test và có thể cause issues.

**Status**: TODO  
**Effort**: 1h

---

### 3.2 LIMIT Regex - Missing MySQL Support

**Location**: `internal/db/executor.go:11`

**Issue**: `limitPattern` không cover hết các dialect, thiếu MySQL LIMIT syntax detection.

**Status**: ✅ DONE (added FETCH clause)  
**Effort**: 30m

---

### 3.3 Password Security

**Location**: `internal/utils/prefs.go`

**Issue**: Password base64 encoded nhưng không có encryption, chỉ là obfuscation.

**Status**: TODO  
**Effort**: 3h

---

### 3.4 Connection Store - Generated Import Risk

**Location**: `frontend/src/stores/connectionStore.ts:5`

**Issue**: Import từ `wailsjs/go/models` có thể break nếu chưa chạy `wails dev`/`wails build`.

**Status**: TODO  
**Effort**: 1h

---

## Priority 4: Low - Improvements

### 4.1 State Management - Missing Error Logging

**Issue**: Zustand stores thiếu middleware cho error logging.

**Status**: TODO  
**Effort**: 2h

---

### 4.2 Unit Tests

**Status**: TODO  
**Effort**: 8h

| Area | Files to Cover |
|------|----------------|
| Go Backend | `internal/db/executor.go`, `internal/app/app.go` |
| Frontend | `stores/editorStore.ts`, `stores/resultStore.ts` |

---

### 4.3 Performance Optimization

**Issue**: Large datasets có thể chậm khi scan rows (dùng `fmt.Sprintf`).

**Status**: TODO  
**Effort**: 4h

---

## Completed

- [x] Initial codebase analysis
- [x] Create this issue tracking file
- [x] Fix TypeScript errors in ResultTable.tsx
- [x] Fix unsafe type cast in App.tsx
- [x] Register MSSQL driver (already done)
- [x] Implement Batch Edit backend call (already done)
- [x] Fix query cancellation race condition
- [x] Improve error notification (add schema:error event)
- [x] Fix LIMIT regex for MySQL support
