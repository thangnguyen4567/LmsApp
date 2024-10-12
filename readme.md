# Android

Để chạy ứng dụng Android, sử dụng lệnh sau:

```bash
npm run android
```
## Trong trưởng hợp chạy lệnh này bị lỗi thì làm các bước sau:
```bash
cd android
.\gradlew clean
cd ..
npm run android
```

## Đưa app lên ch play: 
Cập nhật versioncode theo đường dẫn android/app/build.gradle

Chạy lệnh:

```bash
Cd android
.\gradlew bundleRelease
```

Vào đường dẫn .\android\app\build\outputs\bundle\release tìm file app-release.aab và đưa file này lên ch play
Truy cập vào trang https://play.google.com/console/u/0/developers đăng nhập bằng tài khoản developer. chọn app cần cập nhật. vào phần release management -> edit -> upload apk -> chọn file app-release.aab -> upload -> cập nhật version -> upload

# IOS
```bash
npm run ios
```