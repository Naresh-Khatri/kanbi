package com.kanbi.focus.dream

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KanbiDreamModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KanbiDream")

    Function("setShowWhenLocked") { value: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.runOnUiThread { activity.setShowWhenLocked(value) }
      }
    }

    Function("setTurnScreenOn") { value: Boolean ->
      val activity = appContext.currentActivity ?: return@Function
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.runOnUiThread { activity.setTurnScreenOn(value) }
      }
    }

    Function("isKeyguardLocked") {
      val context: Context = appContext.reactContext ?: return@Function false
      val km = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      km?.isKeyguardLocked ?: false
    }

    AsyncFunction("dismissKeyguard") { promise: Promise ->
      val activity: Activity = appContext.currentActivity
        ?: return@AsyncFunction promise.resolve(false)
      val km = activity.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      if (km == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        promise.resolve(false)
        return@AsyncFunction
      }
      activity.runOnUiThread {
        km.requestDismissKeyguard(activity, object : KeyguardManager.KeyguardDismissCallback() {
          override fun onDismissSucceeded() {
            promise.resolve(true)
          }

          override fun onDismissCancelled() {
            promise.resolve(false)
          }

          override fun onDismissError() {
            promise.resolve(false)
          }
        })
      }
    }
  }
}
