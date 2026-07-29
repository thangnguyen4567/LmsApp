package com.lms

import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Dò và mở app AMIS trên Android.
 *
 * Vì sao phải viết native: MISA yêu cầu kiểm tra AMIS đã cài hay chưa **theo
 * package name** (`vn.com.misa.amis`), mà `Linking` của React Native chỉ nhận
 * URL chứ không nhận package name. Còn `canOpenURL("https://misajsc.amis.vn")`
 * thì luôn trả `true` vì trình duyệt cũng nhận link https — vô nghĩa để dò.
 *
 * ⚠️ Cần khai `<queries><package android:name="vn.com.misa.amis" />` trong
 * AndroidManifest, nếu không từ Android 11 (API 30) `getPackageInfo()` sẽ ném
 * `NameNotFoundException` dù máy CÓ cài AMIS.
 */
class AmisDetectModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /** Máy đã cài `packageName` chưa. Không ném lỗi — mọi trục trặc đều là `false`. */
  @ReactMethod
  fun isPackageInstalled(packageName: String?, promise: Promise) {
    if (packageName.isNullOrEmpty()) {
      promise.resolve(false)
      return
    }
    try {
      reactApplicationContext.packageManager.getPackageInfo(packageName, 0)
      promise.resolve(true)
    } catch (_: PackageManager.NameNotFoundException) {
      // Chưa cài, HOẶC thiếu khai <queries> — Android không phân biệt hai case này.
      promise.resolve(false)
    } catch (_: Exception) {
      promise.resolve(false)
    }
  }

  /**
   * Mở URL bằng ĐÚNG app chỉ định, không bao giờ rơi ra trình duyệt.
   *
   * `setPackage()` khoá intent vào riêng app AMIS, nên không phụ thuộc việc
   * MISA đã xác thực App Link (`assetlinks.json`) hay chưa — đó là điều kiện
   * mà link `https://misajsc.amis.vn` thường bị vướng trên Android 12+.
   *
   * Không mở được thì **reject** để phía JS biết mà xử lý, thay vì âm thầm đưa
   * người dùng sang trình duyệt.
   */
  @ReactMethod
  fun openInApp(url: String?, packageName: String?, promise: Promise) {
    if (url.isNullOrEmpty()) {
      promise.reject(ERR_BAD_URL, "URL rong")
      return
    }
    try {
      val intent =
          Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
            if (!packageName.isNullOrEmpty()) {
              setPackage(packageName)
            }
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
      // Ưu tiên activity đang hiển thị; app bị đưa xuống nền thì dùng context.
      (reactApplicationContext.currentActivity ?: reactApplicationContext)
          .startActivity(intent)
      promise.resolve(true)
    } catch (e: ActivityNotFoundException) {
      promise.reject(ERR_NO_APP, "Khong tim thay app xu ly: $packageName", e)
    } catch (e: Exception) {
      promise.reject(ERR_OPEN_FAILED, e.message, e)
    }
  }

  companion object {
    const val NAME: String = "AmisDetect"
    private const val ERR_BAD_URL = "E_BAD_URL"
    private const val ERR_NO_APP = "E_NO_APP"
    private const val ERR_OPEN_FAILED = "E_OPEN_FAILED"
  }
}
