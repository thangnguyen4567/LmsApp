import {Linking, NativeModules, Platform, TurboModuleRegistry} from 'react-native';

/**
 * Cầu nối tới module native `AmisDetect` (chỉ có trên Android).
 *
 * Cần vì MISA yêu cầu kiểm tra AMIS đã cài hay chưa **theo package name**, mà
 * `Linking` chỉ làm việc với URL. Xem
 * android/app/src/main/java/com/lms/AmisDetectModule.kt
 *
 * ⚠️ Module nằm trong chính app (không phải package npm) nên **phải build lại
 * Android** thì JS mới thấy. Cả file được viết để khi KHÔNG có module (bản build
 * cũ, hoặc iOS) thì mọi thứ lùi về hành vi trước đây thay vì ném lỗi.
 */

const NAME = 'AmisDetect';

function resolveNativeModule() {
    if (Platform.OS !== 'android') {
        return null;
    }
    // Bridgeless lấy qua TurboModuleRegistry; NativeModules là đường lùi cho
    // chế độ cũ.
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
 * Trả `null` khi KHÔNG kiểm tra được (iOS, hoặc Android chưa build lại) — cố ý
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
 * Mở URL bằng ĐÚNG app chỉ định (`setPackage`), nên không phụ thuộc việc MISA
 * đã xác thực App Link (`assetlinks.json`) hay chưa — điểm rất dễ vướng trên
 * Android 12+.
 *
 * ⚠️ Mở không được thì trả `false` và KHÔNG làm gì cả. Cố tình không lùi về
 * `Linking.openURL`: link AMIS là link https nên đường lùi đó sẽ ném người dùng
 * chưa cài AMIS vào trình duyệt, chẳng giúp được gì mà còn khó hiểu. Chỉ khi
 * hoàn toàn không có module native (bản build cũ) mới lùi về `Linking`.
 */
export async function openUrlInApp(url, packageName) {
    if (!url) {
        return false;
    }
    if (amisNative) {
        if (!packageName) {
            return false;
        }
        try {
            await amisNative.openInApp(url, packageName);
            return true;
        } catch (_e) {
            // Chưa cài AMIS, hoặc AMIS không nhận URL này.
            return false;
        }
    }
    try {
        await Linking.openURL(url);
        return true;
    } catch (_e) {
        return false;
    }
}
