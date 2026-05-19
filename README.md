# Auto Service — Facebook Auto Comment Bot

Công cụ tự động bình luận Facebook sử dụng mô hình **Human-Like Simulation** (ngụy trang con người). Hỗ trợ cả phiên bản **Desktop/Web** và **Mobile (Android APK)**.

> **Miễn phí 100%** — không cần Access Token hay Cookie. Bot hoạt động bằng cách mở trình duyệt thật và mô phỏng thao tác người dùng.

---

## Mục lục

- [Tính năng chính](#tính-năng-chính)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Cài đặt & Khởi chạy](#cài-đặt--khởi-chạy)
  - [Web / Desktop](#web--desktop-web)
  - [Mobile APK](#mobile-apk-mobile)
- [Cách hoạt động](#cách-hoạt-động)
- [Lưu ý an toàn](#lưu-ý-an-toàn)

---

## Tính năng chính

- Tự động bình luận trên bài viết cá nhân và bài viết trong Group.
- Giao diện Desktop (customtkinter) và Web Dashboard (Flask + SocketIO).
- Ứng dụng Mobile (React Native + Expo) — build thành APK chạy độc lập trên Android.
- Mô phỏng hành vi người thật: di chuột, gõ phím chậm, gõ sai rồi sửa, cuộn trang tự nhiên.
- Nội dung bình luận được lấy ngẫu nhiên từ file `comments.txt` — dễ dàng tùy chỉnh.

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Web Bot Core | Python 3, Selenium, webdriver-manager |
| Desktop GUI | customtkinter |
| Web Dashboard | Flask, Flask-SocketIO, Flask-CORS |
| Mobile App | React Native (Expo), TypeScript, WebView |
| Linting | pre-commit (trailing-whitespace, end-of-file-fixer, ...) |

---

## Cấu trúc dự án

```
auto_service/
├── README.md
├── comments.txt            # Danh sách bình luận mẫu
├── groups.txt              # Danh sách group mẫu
├── .pre-commit-config.yaml
├── web/                    # Phiên bản Desktop & Web
│   ├── gui.py              # Entry point — giao diện Desktop
│   ├── app.py              # Entry point thay thế (gọi gui)
│   ├── main.py             # Core bot logic
│   ├── server.py           # Flask + SocketIO backend
│   ├── requirements.txt
│   ├── templates/
│   │   └── index.html      # Web dashboard
│   └── src/
│       ├── core/
│       │   ├── facebook_bot.py
│       │   ├── browser.py
│       │   ├── group_scraper.py
│       │   └── human_actions.py
│       ├── gui/
│       │   └── main_window.py
│       └── utils/
│           ├── file_parser.py
│           └── logger.py
└── mobile/                 # Phiên bản Android APK
    ├── App.tsx              # Entry point React Native
    ├── package.json
    ├── tsconfig.json
    ├── app.json
    ├── src/
    │   ├── automation.js
    │   ├── automation_string.js
    │   ├── automation_string.ts
    │   └── facebook_webview_bridge.ts
    └── android/             # Native Android project
```

---

## Cài đặt & Khởi chạy

### Yêu cầu chung

- Git
- Python >= 3.9 (cho phiên bản Web/Desktop)
- Node.js >= 18 (cho phiên bản Mobile)

### Web / Desktop (`web/`)

```bash
# 1. Clone repo
git clone https://github.com/anhntdevvn/auto_service.git
cd auto_service

# 2. Cài đặt dependencies
cd web
pip install -r requirements.txt

# 3. Chuẩn bị nội dung bình luận
#    Mở file comments.txt và nhập mỗi câu bình luận trên 1 dòng.

# 4a. Chạy giao diện Desktop
python3 gui.py

# 4b. Hoặc chạy Web Dashboard (điều khiển từ xa)
python3 server.py
# Truy cập dashboard tại: http://localhost:5000
```

**Thiết lập thông số:**

| Thông số | Mô tả |
|---|---|
| Group/Post URL | Link của Group hoặc bài viết cần bình luận |
| Max Posts | Số bài viết tối đa bot sẽ xử lý |
| Delay (giây) | Thời gian chờ giữa 2 bài liên tiếp (khuyến nghị 5–10s) |

> **Lần đầu chạy:** Trình duyệt Chrome sẽ mở lên — hãy đăng nhập Facebook thủ công. Phiên đăng nhập được lưu vào `chrome_data/`, các lần sau không cần đăng nhập lại.

### Mobile APK (`mobile/`)

Ứng dụng Android độc lập — tích hợp WebView và bộ tự động hóa JavaScript bên trong.

```bash
cd mobile

# Cài đặt dependencies
npm install

# Build & cài thẳng vào điện thoại (yêu cầu cắm USB + Android SDK)
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
npx expo run:android
```

**Cách sử dụng trên điện thoại:**

1. Mở app **Facebook Auto Comment Bot**.
2. Đăng nhập Facebook trong phần trình duyệt phía dưới.
3. Nhập danh sách Group và nội dung Comment tại bảng điều khiển.
4. Nhấn **Lưu dữ liệu** → **Bắt đầu chạy**.
5. Theo dõi tiến độ tại mục **Nhật ký hoạt động**.

---

## Cách hoạt động

Bot **không** sử dụng Access Token hay Cookie API — thay vào đó, nó mô phỏng hành vi người dùng thật:

1. Mở trình duyệt Chrome thật (Desktop) hoặc WebView (Mobile).
2. Tái sử dụng phiên đăng nhập Facebook đã lưu (không gửi Cookie lên server nào).
3. Tự động phân tích giao diện trang Facebook để tìm ô bình luận.
4. Di chuyển chuột và click giống tay người.
5. Gõ từng ký tự với tốc độ ngẫu nhiên, cố tình gõ sai rồi sửa — mô phỏng người thật.
6. Sau khi gửi bình luận, cuộn xuống bài tiếp theo và lặp lại.

Nhờ kỹ thuật **Human-Like Simulation**, bot vượt qua các cơ chế phát hiện tự động của Facebook mà không cần thao tác Token phức tạp.

---

## Lưu ý an toàn

- **Delay hợp lý:** Đặt delay ít nhất 5–10 giây giữa các bài viết.
- **Giới hạn số lượng:** Không nên đặt Max Posts quá cao (> 50) trong một phiên.
- **Nguy cơ:** Nếu bình luận quá nhanh hoặc quá nhiều, Facebook có thể tạm khóa chức năng bình luận của tài khoản vài ngày do vi phạm Tiêu chuẩn Cộng đồng.
- **Khuyến nghị:** Chạy từ từ, chia nhỏ các phiên, và theo dõi trạng thái tài khoản thường xuyên.
