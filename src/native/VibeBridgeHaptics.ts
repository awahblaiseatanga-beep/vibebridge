import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  NativeHapticPatternRequest,
  NativeHapticRenderResponse,
  NativeHapticsCapabilities,
} from './types';

interface VibeBridgeHapticsNativeModule {
  isAvailable?: () => boolean;
  getCapabilitiesAsync?: () => Promise<NativeHapticsCapabilities>;
}

function getNativeModule(): VibeBridgeHapticsNativeModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    return requireOptionalNativeModule<VibeBridgeHapticsNativeModule>('VibeBridgeHaptics');
  } catch {
    return null;
  }
}

/**
 * Queries real Android Vibrator / VibratorManager hardware capabilities without simulating results.
 * Safely reports `moduleInstalled: false` inside Expo Go.
 */
export async function checkNativeHapticsCapabilities(): Promise<NativeHapticsCapabilities> {
  if (Platform.OS !== 'android') {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      hasVibrator: false,
      hasAmplitudeControl: false,
      supportsPrimitives: false,
      supportedPrimitives: {},
      rendererImplemented: false,
      status: 'unsupported',
      error: `VibeBridgeHaptics native module is Android-only (current platform: ${Platform.OS}).`,
    };
  }

  const nativeModule = getNativeModule();
  if (!nativeModule || typeof nativeModule.getCapabilitiesAsync !== 'function') {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      hasVibrator: false,
      hasAmplitudeControl: false,
      supportsPrimitives: false,
      supportedPrimitives: {},
      rendererImplemented: false,
      status: 'unavailable',
      error:
        'VibeBridgeHaptics native module is not installed in this runtime (Expo Go). Custom development build required.',
    };
  }

  try {
    const result = await nativeModule.getCapabilitiesAsync();
    return {
      ...result,
      moduleInstalled: Boolean(result?.moduleInstalled ?? true),
      moduleAvailable: Boolean(result?.moduleAvailable),
      capabilitySupported: Boolean(result?.capabilitySupported),
      hasVibrator: Boolean(result?.hasVibrator),
      hasAmplitudeControl: Boolean(result?.hasAmplitudeControl),
      supportsPrimitives: Boolean(result?.supportsPrimitives),
      supportedPrimitives: result?.supportedPrimitives ?? {},
      rendererImplemented: Boolean(result?.rendererImplemented ?? false),
      status: result?.status ?? 'executed',
    };
  } catch (err: any) {
    return {
      moduleInstalled: true,
      moduleAvailable: false,
      capabilitySupported: false,
      hasVibrator: false,
      hasAmplitudeControl: false,
      supportsPrimitives: false,
      supportedPrimitives: {},
      rendererImplemented: false,
      status: 'failed',
      error: err?.message || 'Failed querying VibeBridgeHaptics capabilities.',
    };
  }
}

/**
 * Phase 1 placeholder entry point: explicitly reports unsupported instead of faking actuation.
 */
export async function renderNativeHapticWaveform(
  _request: NativeHapticPatternRequest
): Promise<NativeHapticRenderResponse> {
  const caps = await checkNativeHapticsCapabilities();
  if (!caps.moduleInstalled) {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      rendererImplemented: false,
      status: 'unavailable',
      error: caps.error,
    };
  }

  return {
    moduleInstalled: true,
    moduleAvailable: caps.moduleAvailable,
    capabilitySupported: caps.capabilitySupported,
    rendererImplemented: false,
    status: 'unsupported',
    androidSdkInt: caps.androidSdkInt,
    deviceModel: caps.deviceModel,
    error: 'Phase 1 foundation only: native waveform rendering is not enabled yet; ExpoHapticEngine remains active.',
  };
}
