# Zentro - Bảng tính năng (Features List)

Danh sách tổng hợp toàn bộ các tính năng đã được phát triển và tích hợp vào dự án Zentro cho đến hiện tại (Sprint 5).

## 1. Kiến trúc & Công nghệ lõi (Core Architecture)
- **Frontend**: React 18, TypeScript, Zustand (quản lý state), CSS thuần (CSS Variables cho thegme).
- **Backend (App Shell)**: Golang + Wails v2.
- **Renderer / Window**: Frameless Window (giao diện cửa sổ không viền system native), điều khiển thông qua custom window controls trên thanh Toolbar. Luồng gọi data giữa frontend/backend qua JSON Wails IPC, đối với khối lượng data lớn (Rows) thì stream thông qua Wails Events (Observer pattern).
- **Lưu trữ cục bộ (Local-first)**: 
  - Lưu thông tin kết nối và cấu hình ở thư mục JSON bảo mật của người dùng hệ điều hành (`~/.config/zentro/` hoặc Windows AppData).
  - Lịch sử truy vấn cũng được persist xuống ổ cứng (File history.json tuần tự hóa).

## 2. Quản lý Kết nối (Connection Management)
- **Hệ quản trị CSDL hỗ trợ**: PostgreSQL (đã implement first-class support) - module driver thiết kế để dễ dàng mở rộng sang các DB engine khác.
- **Quản lý cấu hình (Profiles)**: 
  - Khởi tạo, chỉnh sửa, xóa Profile (Name, Host, Port, Database, User, Password, SSL mode, Timeout).
  - Giao diện dialog config trực quan.
  - Tùy chọn nhớ mật khẩu an toàn (`Save Password` bọc bằng hash base64 ở layer lưu trữ tạm tuỳ version).
- **Test Connection**: Tính năng Ping/Test tới cấu hình server trực tiếp từ UI.
- **Quản lý trạng thái (Connect/Disconnect)**: Menu chuột phải tại tree node ngoài chức năng Connect/Edit/Delete còn tích hợp quick Disconnect để giải phóng resource DB pool.

## 3. Khám phá Cây Dữ liệu (Schema Explorer Tree)
- **Lazy Loading Tree**: Tiết kiệm tài nguyên lớn. Chỉ fetch cấu trúc schemas, tables, functions... khi người dùng bấm mở node (expand tree pointer) chứ không load hết từ đầu.
- **Context Switch nhanh (Overlay/Toolbar)**: Cho phép chuyển đổi nhanh Connection Profile đang active thông qua menu thả cấp ở toolbar mà không cần vào lại sidebar.
- **Cấu trúc DBeaver-style Schema**:  
  - Phân nhánh các đối tượng (Object) của DB theo các cấp: Schema -> Table / View / Sequence / Function...
  - Support list phong phú (Postgres): Table thông thường, System View, Materialized View, Foreign Table, Data Type, Aggregate Function, Index.
- **Bảng & Cột**: Khi click sâu vào Node của Bảng, hiển thị toàn bộ cột (Columns), primary keys, constraints...

## 4. Giao diện (UI Layout & Theme)
- **App Shell chuẩn IDE**: Split pane layout với thanh bên (Sidebar) thu/phóng/kéo thả được (Resizeable).  
- **Window Controls tùy biến**: Nút đóng/nhỏ/to cửa sổ (window controls) trên hệ điều hành Windows tích hợp trực tiếp góc phải thanh Toolbar siêu liền mạch giống app VSCode hoặc Spotify. Breadcrumb cho phép kéo thả làm vùng "drag app" ở thanh Toolbar.
- **Status Bar (Thanh trạng thái)**: Bám viền dưới, báo cáo Server/Cấu hình đang kết nối trực quan, cảnh báo lỗi toast text, thời gian chạy query.
- **Settings Panel Dialog**: Chỉnh các tham số trải nghiệm app cá nhân hóa:
  - Theme (Dark/Light Mode).
  - Default Row Limit (Giới hạn fetch rows mặc định).
  - Font Size.
  - Tự động save `Preferences`.

## 5. Trình soạn thảo SQL (Monaco Editor)
- **Core Engine (Monaco/VS Code)**: Tích hợp engine editor của VSCode ngay trong React app. Xử lý hàng chục ngàn dòng script cực kì nhẹ. 
  - Tích hợp Auto-completion (Gợi ý code/Auto-suggest table, columns theo Schema đang làm việc).
  - Syntax Highlighting rực rỡ và Dark/Light mode sync chuẩn IDE.
- **Quản lý Đa Tab (Tab Bar)**: 
  - Mở/đóng tab linh hoạt (`Ctrl+T` tạo mới, `Ctrl+W` đóng tab).
  - Cảnh báo "Unsaved Changes" nếu vô tình đóng lúc đang chỉnh sửa query.
  - Context menu tab: Rename (bấm F2 để sửa tên script tab), Close All, Close Others.
- **Hotkey Execute**: Cấu hình chuẩn ngón tay (`Ctrl+Enter` thực thi run block/script).

## 6. Lưới kết quả truy vấn (Data Result Grid)
- **Async Streaming Execution (Goroutine Stream)**: Query SELECT kéo kết quả về giao diện dưới dạng phân nhỏ (chunk 500 dòng/lần emit) giúp giao diện không bị treo / đơ khi query data chục ngàn dòng (Progressive loading).
- **TanStack Virtualized Grid**: Render "ảo" (ảo hoá DOM) grid hiển thị. Có thể cuộn siêu mượt 50 ngàn đến 1 triệu dòng Data Grid với 60fps mượt mà vì DOM chỉ giữ 40-50 nodes.
- **Vô hạn cuộn (Infinite Scroll / Pagination)**: Khi scroll thanh kéo quá số records stream về, tự động trigger backend SQL offset lấy trang tiếp theo fill vào bảng.
- **Đếm tổng dòng không cần tải (Total Row Count)**: Nút `Total` tính năng đo lượng Data Result xấp xỉ bằng lệnh Count giấu kín (tốc độ cao).
- **Hủy phiên truy vấn nhanh (Cancel Query)**: Context timeout ở driver layer, cho phép nút Stop cắt ngay Query cực to làm DB pending.
- **Chỉnh sửa Batch Edit (Data Cell)**: 
  - Bôi đen (Select) phạm vi hàng loạt các cell của data grid (Alt-click, Shift Range select).
  - Đúp chuột input giá trị -> Commit (Enter) gán cùng giá trị cho tất cả các cell chọn.
  - Highlight màu các cell bị "Dirty" đang bị thay đổi nhưng chưa sync với DB.
- **Export Data**: Nút `Export` nhanh ra định dạng file \`.csv\` bằng Dialog Native.
- **DDL & DML (Update/Insert)**: Hỗ trợ báo cáo text thông báo "affected rows", tốc độ run query khi không phải lệnh SELECT (không trả ResultGrid mà báo Alert Success).

## 7. Truy vấn lịch sử (Query History Panel)
- **Panel riêng biệt**: Frame xem lịch sử bên tay trái Sidebar (History icon tab).
- **Lưu toàn bộ context**: Lưu cả string Query (highlight SQL), Profile đã thực thi, User thực thi, Lỗi gặp phải (nếu error), Thời gian DB trả về. Limit danh sách quay vòng (mặc định 500 limit).
- **Thao tác nhanh**: Click chuột lịch sử đổ thẳng lại vào Editor đang kích hoạt. Hỗ trợ nút Trash để xóa sạch list.
