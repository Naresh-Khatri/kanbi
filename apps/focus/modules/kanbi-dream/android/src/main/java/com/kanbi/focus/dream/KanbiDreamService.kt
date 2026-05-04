package com.kanbi.focus.dream

import android.os.Bundle
import android.service.dreams.DreamService
import com.facebook.react.ReactInstanceManager
import com.facebook.react.ReactRootView
import com.facebook.react.ReactApplication

/**
 * System DreamService entry point. When the device is docked / charging
 * and goes idle, Android starts this service and it hands a ReactRootView
 * the "KanbiDream" JS component (registered via AppRegistry in
 * index.dream.tsx). Touches pass through because we set isInteractive
 * + setInteractive(true).
 */
class KanbiDreamService : DreamService() {
  private var reactRootView: ReactRootView? = null
  private var reactInstanceManager: ReactInstanceManager? = null

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    isInteractive = true
    isFullscreen = true
    setScreenBright(true)

    val app = applicationContext as? ReactApplication ?: run {
      finish()
      return
    }

    val rim = app.reactNativeHost.reactInstanceManager
    val rootView = ReactRootView(this)
    rootView.startReactApplication(rim, "KanbiDream", Bundle())

    reactInstanceManager = rim
    reactRootView = rootView
    setContentView(rootView)
  }

  override fun onDetachedFromWindow() {
    reactRootView?.unmountReactApplication()
    reactRootView = null
    reactInstanceManager = null
    super.onDetachedFromWindow()
  }
}
