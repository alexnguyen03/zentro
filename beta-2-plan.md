# Beta 2 Release Plan

> Last updated: 2026-03-18

---

## Phase 1: Must Have

### 1. Data Viewing & Export

| # | Feature | Description | Backend | Frontend |
|---|---------|-------------|---------|----------|
| 1.1 | JSON Viewer | Format & syntax highlight JSON in cells | ✅ Handler exists | Need UI cell renderer |
| 1.2 | BLOB Viewer | Preview images/binary data | ✅ Exists | Need UI |
| 1.3 | Export JSON | Export query results to JSON | Need to add | Need UI |
| 1.4 | Export SQL INSERT | Generate INSERT statements | Need to add | Need UI |
| 1.5 | Date/Time Formatting | Format datetime cells beautifully | - | Need UI |

### 2. Schema Management

| # | Feature | Description | Backend | Frontend |
|---|---------|-------------|---------|----------|
| 2.1 | CREATE TABLE UI | Visual table designer | Need to add | Need UI |
| 2.2 | View DDL | View CREATE TABLE script | Need to add | Need UI |
| 2.3 | DROP TABLE/VIEW | Delete objects from UI | Need to add | Need UI |
| 2.4 | Index Management | Create/Drop indexes | Need to add | Need UI |

---

## Phase 2: Important

### 3. Data Editing

| # | Feature | Description | Backend | Frontend |
|---|---------|-------------|---------|----------|
| 3.1 | Add New Row | UI to add new record (inline, no modal) | Need to add | Need UI |
| 3.2 | Duplicate Selected Rows | Copy selected rows and insert below | Need to add | Need UI |
| 3.3 | Delete Row | Delete row from grid (inline toast, no popup) | ✅ Partial | Need to complete |
| 3.4 | Bulk Delete | Delete multiple rows | Need to add | Need UI |

### 4. Query Features

| # | Feature | Description | Backend | Frontend |
|---|---------|-------------|---------|----------|
| 4.1 | Transaction Control | BEGIN/COMMIT/ROLLBACK UI | Need to add | Need UI |
| 4.2 | Multiple Result Sets | Handle multiple SELECT queries | Need refactor | Need UI tabs |
| 4.3 | EXPLAIN Support | Show execution plan | Need to add | Need UI |

---

## Phase 3: Nice to Have

### 5. Search & Filter

| # | Feature | Description | Backend | Frontend |
|---|---------|-------------|---------|----------|
| 5.1 | Table Search | Full-text search in table | Need to add | Need UI |
| 5.2 | Schema Search | Search objects in sidebar | - | ✅ DONE (ConnectionTree.tsx) |

### 6. UX Improvements

| # | Feature | Description | Backend | Frontend |
|---|---------|-------------|---------|----------|
| 6.1 | Query Formatting | Prettify SQL | - | Need Monaco plugin |
| 6.2 | Bookmarks | Bookmark lines in editor | - | Need UI |
| 6.3 | Snippets | Custom code snippets | ✅ DONE (TemplateService) | ✅ DONE (TemplatePopover) |
| 6.4 | Query Compare | Diff 2 queries | - | Need UI |
| 6.5 | Keyboard Shortcuts Editor | Customize shortcuts | - | Need UI |

---

## Technical Debt

| # | Task | Priority | Effort |
|---|------|----------|--------|
| TD.1 | Password encryption | Medium | 3h |
| TD.2 | Error logging middleware | Low | 2h |
| TD.3 | Unit tests | Low | 8h |
| TD.4 | Performance optimization | Low | 4h |

---

## Release Checklist

- [ ] Phase 1 features complete
- [ ] Phase 2 features complete
- [ ] All known issues resolved
- [ ] Unit tests passing
- [ ] Build succeeds for all platforms
- [ ] Release notes updated
- [ ] Version bump (v0.2.0)
