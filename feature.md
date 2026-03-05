# Zentro - Features List

Complete list of features developed and integrated into the Zentro project to date (Sprint 5).

## 1. Core Technology & Architecture 
- **Frontend**: React 18, TypeScript, Zustand (state management), Vanilla CSS (CSS Variables for theming).
- **Backend (App Shell)**: Golang + Wails v2.
- **Renderer / Window**: Frameless Window (native borderless window interface), controlled via custom window controls on the Toolbar. Data flow between frontend/backend via JSON Wails IPC, for large datasets (Rows), data is streamed via Wails Events (Observer pattern).
- **Local-first Storage**:
  - Connection info and configs are saved securely in the OS user JSON directory (`~/.config/zentro/` or Windows AppData).
  - Query history is persisted to the local drive (serialized `history.json` file).

## 2. Connection Management
- **Supported Databases**: PostgreSQL (first-class support implemented) - driver module designed for easy extension to other DB engines.
- **Profile Management**:
  - Create, edit, delete Profiles (Name, Host, Port, Database, User, Password, SSL mode, Timeout).
  - Intuitive config dialog interface.
  - Secure remember password option (`Save Password` wrapped with base64 hashing at the storage layer).
- **Test Connection**: Ping/Test server config directly from the UI.
- **State Management (Connect/Disconnect)**: Right-click context menu at the tree node integrates quick Disconnect feature to release DB pool resources, besides Connect/Edit/Delete actions.

## 3. Schema Explorer Tree
- **Lazy Loading Tree**: High resource saving. Only fetches structures like schemas, tables, functions... when the user expands the tree pointer, instead of loading everything upfront.
- **Fast Context Switch (Overlay/Toolbar)**: Switch active Connection Profile quickly via a drop-down menu on the toolbar without returning to the sidebar.
- **DBeaver-style Schema Structure**:
  - Branches DB objects hierarchically: Schema -> Table / View / Sequence / Function...
  - Rich entity support (Postgres): Regular Table, System View, Materialized View, Foreign Table, Data Type, Aggregate Function, Index.
- **Tables & Columns**: Clicking deep into a Table Node displays all columns, primary keys, constraints...

## 4. UI Layout & Theme
- **IDE-standard App Shell**: Split pane layout with resizable Sidebar.
- **Custom Window Controls**: OS window controls (close/minimize/maximize) on Windows are natively integrated directly into the right corner of the Toolbar, providing a seamless experience similar to VSCode or Spotify. Breadcrumbs area acts as an app drag region on the Toolbar.
- **Status Bar**: Sticks to the bottom, intuitively reports active Server/Config connection, displays toast text errors, and query execution time.
- **Settings Panel Dialog**: Customize personalized app experience parameters:
  - Theme (Dark/Light Mode).
  - Default Row Limit (Default fetch rows limit).
  - Font Size.
  - Auto-save `Preferences`.

## 5. SQL Editor (Monaco Editor)
- **Core Engine (Monaco/VS Code)**: VSCode's editor engine integrated straight into the React app. Handles tens of thousands of lines of script extremely lightly.
  - Integrated Auto-completion (Code suggestions/Auto-suggest tables and columns based on the active Schema).
  - Vibrant Syntax Highlighting with IDE-standard Dark/Light mode sync.
- **Multi-Tab Management (Tab Bar)**:
  - Flexible tab open/close (`Ctrl+T` to create new, `Ctrl+W` to close tab).
  - "Unsaved Changes" warning if accidentally closed while editing a query.
  - Tab context menu: Rename (press F2 to rename script tab), Close All, Close Others.
- **Execute Hotkey**: Ergonomic config (`Ctrl+Enter` to execute run block/script).

## 6. Data Result Grid
- **Async Streaming Execution (Goroutine Stream)**: SELECT queries pull results to the UI in small chunks (emit 500 rows per chunk), preventing UI freezes/hangs when querying tens of thousands of rows of data (Progressive loading).
- **TanStack Virtualized Grid**: Virtual DOM rendering for the display grid. Super smooth 60fps scrolling for Data Grids with 50,000 to 1,000,000 rows, utilizing only 40-50 nodes in the DOM.
- **Infinite Scroll / Pagination**: Automatically triggers backend SQL offset to fetch the next page and append to the grid when scrolling past the returned stream records.
- **Total Row Count**: Fast measurement of approximate Data Result volume using a hidden Count query via the `Total` button without having to fetch all rows.
- **Quick Query Cancellation**: Context timeout at the driver layer allows the Stop button to immediately terminate huge queries causing DB pending manually.
- **Batch Edit (Data Cell)**:
  - Select ranges of cells in the data grid (Alt-click, Shift Range select).
  - Double-click input value -> Commit (Enter) assigns the same value to all selected cells in the column.
  - Color-highlight "Dirty" cells that have been modified but not yet synced with the DB.
- **Export Data**: Native Dialog for quick `Export` to \`.csv\` file format.
- **DDL & DML (Update/Insert)**: Supports text reporting for "affected rows" and query execution speed for non-SELECT commands (displays Alert Success instead of returning a ResultGrid).

## 7. Query History Panel
- **Dedicated Panel**: Separate history view frame on the left Sidebar (History icon tab).
- **Full Context Storage**: Saves Query string (with SQL highlighting), Executed Profile, Database, Encountered Errors (if any), and DB Response Time. Rolling list limit (default 500 limit).
- **Quick Actions**: Clicking on a history item inserts the query directly back into the active Monaco tab. Supports a Trash button to clear the entire list.
