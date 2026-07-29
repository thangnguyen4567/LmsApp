package com.lms

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Đăng ký [AmisDetectModule]. Module này không autolink được (nằm ngay trong
 * app chứ không phải một package npm) nên phải thêm tay ở MainApplication.
 *
 * Dùng `BaseReactPackage` thay cho `ReactPackage` để chạy được với Kiến trúc
 * Mới (dự án đang bật `newArchEnabled=true`).
 */
class AmisDetectPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == AmisDetectModule.NAME) AmisDetectModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        AmisDetectModule.NAME to
            ReactModuleInfo(
                AmisDetectModule.NAME,
                AmisDetectModule.NAME,
                false, // canOverrideExistingModule
                false, // needsEagerInit — chỉ khởi tạo khi JS gọi tới
                false, // isCxxModule
                false, // isTurboModule — module Java/Kotlin cũ, chạy qua lớp interop
            )
    )
  }
}
