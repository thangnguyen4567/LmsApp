import {Linking, NativeModules, Platform, TurboModuleRegistry} from 'react-native';

/**
 * Cầu nối tới module native `AmisDetect` (chỉ có trên Android).
 *
 * Vì sao cần: MISA yêu cầu kiểm tra AMIS đã cài hay chưa **theo package name**
 * `vn.com.misa.amis`, mà `Linking` của React Native chỉ làm việc với URL.
 * Xem android/app/src/main/java/com/lms/AmisDetectModule.kt
 *
 * ⚠️ Module nằm trong chính app (không phải package npm) nên **phải build lại
 * Android** thì JS mới thấy. Toàn bộ file này được viết để khi KHÔNG có module
 * (bản build cũ, hoặc iOS) thì mọi thứ lùi về đúng hành vi trước đây thay vì
 * ném lỗi.
 */

const NAME = 'AmisDetect';

function resolveNativeModule() {
    if (Platform.OS !== 'android') {
        return null;
    }
    // Kiến trúc Mới (bridgeless) lấy qua TurboModuleRegistry; giữ NativeModules
    // làm đường lùi cho trường hợp chạy ở chế độ cũ.
    try {
        const viaTurbo = TurboModuleRegistry && TurboModuleRegistry.get(NAME);
        if (viaTurbo) {
            return viaTurbo;
        }
    } catch (_e) {
        // get() có thể ném nếu registry chưa sẵn sàng — rơi xuống dưới.
    }
    return (NativeModules && NativeModules[NAME]) || null;
}

const amisNative = resolveNativeModule();

/** Bản build hiện tại có module native không. */
export function hasAmisNativeModule() {
    return Boolean(amisNative);
}

/**
 * Máy đã cài `packageName` chưa.
 * Trả `null` khi KHÔNG kiểm tra được (iOS, hoặc chưa build lại Android) — cố ý
 * phân biệt với `false`, để tầng trên không kết luận nhầm là "chưa cài".
 */
export async function isPackageInstalled(packageName) {
    if (!amisNative || !packageName) {
        return null;
    }
    try {
        return Boolean(await amisNative.isPackageInstalled(packageName));
    } catch (_e) {
        return null;
    }
}

/**
 * Mở URL bằng ĐÚNG app chỉ định, không rơi ra trình duyệt.
 *
 * Có `setPackage` nên không phụ thuộc việc MISA đã xác thực App Link
 * (`assetlinks.json`) hay chưa — thứ mà link `https://misajsc.amis.vn` rất dễ
 * vướng trên Android 12+.
 *
 * Không có module native (iOS / build cũ) thì lùi về `Linking.openURL` như cũ.
 */
export async function openUrlInApp(url, packageName) {
    if (!url) {
        return false;
    }
    if (amisNative && packageName) {
        try {
            await amisNative.openInApp(url, packageName);
            return true;
        } catch (_e) {
            // Chưa cài AMIS, hoặc AMIS không nhận URL này. Rơi xuống đường lùi
            // để ít nhất người dùng thấy một cái gì đó thay vì im lặng.
        }
    }
    try {
        await Linking.openURL(url);
        return true;
    } catch (_e) {
        return false;
    }
}
