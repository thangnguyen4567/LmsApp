# Khởi tạo dự án sau khi clone

## Cài đặt dependencies
```bash
npm install
# hoặc
yarn install
```

## Khởi tạo cho Android
```bash
# Cấu hình biến môi trường (nếu chưa có)
# Thêm vào file .bash_profile hoặc .zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Tạo file local.properties trong thư mục android (nếu chưa có)
# Thêm dòng: sdk.dir=/path/to/your/Android/Sdk
```

## Khởi tạo cho iOS
```bash
cd ios
pod install
cd ..
```

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

## Trong trường hợp chạy lệnh này bị lỗi thì làm các bước sau:
```bash
cd ios && pod install
cd .. && npm run ios
```

```bash
# Nếu vẫn bị lỗi, thử xóa thư mục build
cd ios && rm -rf build
pod install
cd .. && npm run ios
```

## Chạy ở chế độ release trước khi upload lên app store

```bash
npm run create-bundle
npx react-native run-ios --configuration Release
```

## Tạo file .ipa để đưa lên App Store
1. Mở project bằng Xcode: mở file `ios/LMS.xcworkspace`
2. Chọn scheme "LMS" và thiết bị "Any iOS Device (arm64)"
3. Cập nhật marketingVersion và buildNumber theo đường dẫn `ios/LMS.xcodeproj/project.pbxproj`
4. Chọn Product -> Archive
5. Sau khi Archive hoàn tất, cửa sổ Organizer sẽ mở ra
6. Chọn phiên bản Archive vừa tạo -> Distribute App -> App Store Connect -> Upload
7. Làm theo các bước còn lại để upload lên App Store Connect

## Đưa app lên App Store:
Truy cập https://appstoreconnect.apple.com/ -> ở góc trên cùng chọn app -> TestFlight -> Tesflight -> ở góc phải chọn phiên bản -> Chọn phiên bản mới -> ở mục Builds chọn Add Build -> Chọn file .ipa -> Submit for Review

## Xử lý một số lỗi thường gặp:
- Lỗi certificates: Mở Xcode -> Preferences -> Accounts -> Chọn Apple ID -> Manage Certificates -> Tạo mới hoặc cập nhật certificates
- Lỗi provisioning profiles: Mở Xcode -> Signing & Capabilities -> Chọn Automatically manage signing
- Lỗi CocoaPods: 
```bash
cd ios
pod deintegrate
pod setup
pod install
```
