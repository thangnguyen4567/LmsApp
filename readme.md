# Android

```bash
npm run android
```
## Trong trưởng hợp chạy lệnh này bị lỗi thì làm các bước sau:
```bash
cd android && .\gradlew clean
npm run android
```
## Chạy ở chế độ release trước khi upload lên ch play
```bash
npx react-native run-android --mode release 
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

## Chạy ở chế độ release trước khi upload lên app store

```bash
npm run create-bundle
npx react-native run-ios --configuration Release
```

Cập nhật marketingVersion theo đường dẫn ios/LMS.xcodeproj/project.pbxproj

truy cập https://appstoreconnect.apple.com/ -> ở góc trên cùng chọn app -> TestFlight -> Tesflight -> ở góc phải chọn phiên bản -> Chọn phiên bản mới -> ở mục Builds chọn Add Build -> Chọn file .ipa -> Submit for Review
