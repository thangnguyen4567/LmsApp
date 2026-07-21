package com.lms

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    val packages =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    getDefaultReactHost(
        context = applicationContext,
        packageList = packages,
        jsMainModulePath = "index",
        jsBundleAssetPath = "index.android.bundle",
        useDevSupport = BuildConfig.DEBUG,
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
