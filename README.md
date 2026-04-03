# 📢 Bot Tự Động Bình Luận Facebook (Có Giao Diện)

Chương trình này là một công cụ tự động hóa hành vi rảnh tay (Browser Automation) sử dụng **Selenium**, được thiết kế để tự động bình luận trên nền tảng Facebook (hỗ trợ cả bài viết cá nhân lẫn bài viết trong Hội Nhóm/Group). 

Đặc biệt, công cụ này đã được **vô hiệu hóa việc trích xuất token OpenAI tốn phí**, và thay vào đó lấy bình luận trực tiếp từ file văn bản tĩnh trên máy bạn để hoàn toàn **miễn phí 100%**.

---

## 🌟 Tại sao không cần Token? (Giải thích luồng hoạt động)

Phần lớn các tool bot trên mạng yêu cầu **Access Token** hoặc **Cookie** qua API để gửi request tới máy chủ Facebook. Tuy nhiên, cách đó rất dễ bị Facebook khóa tài khoản (Check-point) vì nó phát hiện ra hành vi bất thường của máy móc.

Tool này hoạt động theo mô hình **Ngụy trang con người (Human Like Simulation)**:
1. Nó **Mở một trình duyệt Google Chrome thật sự** lên màn hình.
2. Nó tái sử dụng chính tài khoản Facebook bạn đã đăng nhập để lướt web (không lấy cắp Cookie gửi lên mạng). Bạn chỉ việc đăng nhập một lần bằng tay, trình duyệt sẽ lưu phiên đăng nhập đó vào thư mục `chrome_data` nằm trên máy tính của bạn.
3. Nó **tự động phân tích màn hình** trang Facebook, tìm xem ô gõ bình luận nằm ở đâu.
4. Nó tự tạo ra thao tác **di chuyển chuột**, click chuột giống tay người.
5. Nó lấy các câu lập trình sẵn từ file text, sau đó **nhập từng ký tự một** với tốc độ chập chờn (cố tình gõ sai rồi xóa đi gõ lại) giống y hệt một người dùng bình thường đang ngồi ấn phím.
6. Sau khi Enter, nó sẽ cuộn chuột xuống bài đăng tiếp theo của Hội Nhóm và lặp lại vòng lặp.

Nhờ việc bắt chước thao tác người thật như vậy, bạn **không cần thao tác Token phức tạp** nào cả mà vẫn vượt qua được các chốt chặn phát hiện Bot của nền tảng web.

---

## 🛠️ Hướng dẫn sử dụng

### 1. Chuẩn bị nội dung bình luận
Mở file `comments.txt` nằm chung thư mục. Hãy nhập vào tất cả các câu bình luận mà bạn muốn bot tự động gõ. 
Mỗi bình luận viết trên 1 dòng. Tool sẽ chọn ngẫu nhiên một dòng để bình luận vào giao diện.

### 2. Khởi chạy Ứng dụng
Bạn đã cài đặt xong môi trường, từ giờ bạn chỉ cần mở Terminal và gõ:
```bash
python3 gui.py
```
> Lúc này cửa sổ **tối màu (Dark Mode)** của ứng dụng sẽ xuất hiện.

### 3. Thiết lập thông số & Chạy
- **Group/Post URL:** Dán link của Nhóm (Group) hoặc Bài viết (Post) mà bạn muốn thả bình luận.
- **Max Posts:** Giới hạn tổng số lượng bài viết mà script sẽ cày (Ví dụ: 10 bài là ngưng).
- **Delay:** Thời gian nghỉ ngơi để uống nước giữa 2 bài liên tiếp (Nên để 5-10 giây để an toàn).
- **Bắt đầu (Start Bot):** Nhấn nút này lúc đã sẵn sàng.

> **LƯU Ý LẦN ĐẦU TIÊN CHẠY:**
> Khi Trình duyệt web tự động hiện lên, nếu Facebook yêu cầu, hãy tự động gõ mật khẩu đăng nhập Facebook của bạn vào trình duyệt. Sau khi đăng nhập xong, bot sẽ nạp lại trang và bắt đầu đi "spam dạo". Các lần chạy lại hôm sau bạn không cần đăng nhập nữa.

---

## ⚠️ Lưu ý an toàn
Mặc dù công cụ được tối ưu chống Bot (Anti-detect), nhưng nếu bạn thiết lập bình luận **quá nhanh** (delay siêu ngắn) hay thiết lập **quá nhiều** (Max Post: 1000) trong thời gian ngắn, hệ thống AI đo lường tần suất của Facebook vẫn có thể tạm thời khóa mõm (Block Comment) của tài khoản bạn vài ngày do vi phạm Tiêu chuẩn Cộng đồng. Hãy thiết lập một cách từ từ và có khoa học!
---

## 📂 Cấu trúc Dự án

Dự án hiện tại được chia làm 2 phần độc lập:

1.  **`web/`**: Chứa code Python + Selenium + Flask. Dùng để chạy bot trên máy tính hoặc điều khiển từ xa qua trình duyệt.
2.  **`mobile/`**: Chứa code **React Native (Standalone APK)**. Dùng để build thành 1 file APK chạy bot tự động 100% trên điện thoại mà không cần máy tính.

---

## 💻 Hướng dẫn Web & Desktop (`web/`)

### 1. Khởi chạy Giao diện Desktop
```bash
cd web
python3 gui.py
```

### 2. Khởi chạy Backend Điều khiển từ xa
```bash
cd web
python3 server.py
```
*Truy cập dashboard tại: `http://localhost:5000`*

---

## 📱 Hướng dẫn Mobile APK Bot (`mobile/`)

Đây là bản **Standalone APK** — một ứng dụng Android độc lập, có sẵn trình duyệt và bộ tự động hóa bên trong. Bạn chỉ cần cài 1 file APK duy nhất là có thể chạy bot 100% trên điện thoại.

### 1. Cơ chế hoạt động
- App tích hợp một vùng trình duyệt (WebView) để chạy Facebook Mobile.
- Bot sẽ tự động "bơm" JavaScript vào trình duyệt này để thực hiện các thao tác bình luận.
- Mọi dữ liệu (Group, Comment) được lưu trực tiếp trên bộ nhớ điện thoại.

### 2. Cách Build & Cài đặt
Để tạo ra file APK và cài vào máy, hãy chạy lệnh sau từ máy tính (yêu cầu cắm cáp USB và cài Android SDK):
```bash
cd mobile
# Cài đặt môi trường và build thẳng vào điện thoại
export ANDROID_HOME="$HOME/Android/Sdk" && \
export PATH="$PATH:$ANDROID_HOME/platform-tools" && \
npx expo run:android
```

### 3. Cách sử dụng trên điện thoại
1. Mở app **Facebook Auto Comment Bot** vừa được cài đặt.
2. Đăng nhập tài khoản Facebook của bạn ngay trong App (phần trình duyệt phía dưới).
3. Tại bảng điều khiển:
    - Nhập danh sách Group và nội dung Comment.
    - Nhấn **Lưu dữ liệu**.
    - Nhấn **Bắt đầu chạy**.
4. Theo dõi tiến độ tại mục **Nhật ký hoạt động**.

---
# auto_service
