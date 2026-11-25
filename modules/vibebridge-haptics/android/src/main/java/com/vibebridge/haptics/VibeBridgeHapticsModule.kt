package com.vibebridge.haptics

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * VibeBridgeHapticsModule (Phase 1 Foundation)
 *
 * Registers the native Android haptics module with Expo Modules Core and queries real
 * device Vibrator/VibratorManager hardware capabilities.
 * Adaptive waveform rendering and FEEL engine integration will be implemented in Phase 3.
 */
class VibeBridgeHapticsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun getVibratorOrNull(): Vibrator? {
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        manager?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }
    } catch (_: Exception) {
      null
    }
  }

  override fun definition() = ModuleDefinition {
    Name("VibeBridgeHaptics")

    Function("isAvailable") {
      true
    }

    AsyncFunction("getCapabilitiesAsync") {
      val vibrator = getVibratorOrNull()
      val hasVibrator = vibrator?.hasVibrator() ?: false
      val hasAmplitudeControl = if (vibrator != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        try {
          vibrator.hasAmplitudeControl()
        } catch (_: Exception) {
          false
        }
      } else {
        false
      }

      val supportedPrimitives = mutableMapOf<String, Boolean>()
      if (vibrator != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val primitivePairs = mutableListOf(
          "click" to VibrationEffect.Composition.PRIMITIVE_CLICK,
          "tick" to VibrationEffect.Composition.PRIMITIVE_TICK
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          primitivePairs.add("lowTick" to VibrationEffect.Composition.PRIMITIVE_LOW_TICK)
          primitivePairs.add("thud" to VibrationEffect.Composition.PRIMITIVE_THUD)
          primitivePairs.add("spin" to VibrationEffect.Composition.PRIMITIVE_SPIN)
        }

        try {
          val ids = primitivePairs.map { it.second }.toIntArray()
          val results = vibrator.arePrimitivesSupported(*ids)
          for (i in primitivePairs.indices) {
            supportedPrimitives[primitivePairs[i].first] = if (i < results.size) results[i] else false
          }
        } catch (_: Exception) {
          for ((name, _) in primitivePairs) {
            supportedPrimitives[name] = false
          }
        }
      }

      val supportsPrimitives = supportedPrimitives.values.any { it }

      mapOf(
        "moduleInstalled" to true,
        "moduleAvailable" to (vibrator != null),
        "capabilitySupported" to hasVibrator,
        "hasVibrator" to hasVibrator,
        "hasAmplitudeControl" to hasAmplitudeControl,
        "supportsPrimitives" to supportsPrimitives,
        "supportedPrimitives" to supportedPrimitives,
        "rendererImplemented" to false,
        "status" to "executed",
        "androidSdkInt" to Build.VERSION.SDK_INT,
        "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL}".trim(),
        "note" to "Phase 1 native registration verified. Native waveform tactile renderer pending Phase 3."
      )
    }
  }
}
