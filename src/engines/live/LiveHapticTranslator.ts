/**
 * LiveHapticTranslator
 *
 * Sound-to-Haptic translation engine designed for live concert performances.
 * Stage B-LIVE.2: Adaptive Haptic Intelligence & Physical Feedback Calibration.
 *
 * Physical Invariants & Safeguards:
 * 1. Mobile vibration motors cannot reproduce continuous audio waveforms.
 * 2. Rapid uncalibrated triggers cause motor saturation, thermal throttling, and sensory numbing.
 * 3. Supports three calibrated physical intensity profiles:
 *    - Subtle: Platform light impacts / selections via Expo Haptics.
 *    - Balanced: Platform heavy / medium impacts via Expo Haptics.
 *    - Strong: Direct hardware rail acceleration via React Native Android Vibration API
 *      with bounded pulses (18ms to 60ms) to overcome ERM motor inertia.
 * 4. Non-destructive event scheduling: preserves bass and percussion attacks while
 *    interleaving vocal formants on subsequent slots so vocals are not permanently starved.
 * 5. Immediate tactile mute and cancellation via cancelAll().
 * 6. Observable telemetry counters for triggered, throttled, and suppressed events.
 */

import { Vibration } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';
import { HapticDriver } from '@/engines/haptic/ExpoHapticEngine';
import {
  ActuatorDriverMode,
  AudioSensitivityProfile,
  HapticIntensityProfile,
  LiveAudioFeatures,
  LiveHapticConfig,
  LiveHapticEvent,
  LiveHapticEventType,
  LiveHapticFeedbackStyle,
  LiveHapticStats,
} from './types';

export interface VibrationDriver {
  vibrate(pattern: number | number[]): void;
  cancel(): void;
}

export class LiveHapticTranslator {
  private config: LiveHapticConfig;
  private hapticDriver: HapticDriver;
  private vibrationDriver: VibrationDriver;

  private lastTriggeredAtMs = 0;
  private totalTriggers = 0;
  private totalThrottled = 0;
  private totalSuppressed = 0;
  private lastTriggerType: LiveHapticEventType = 'none';

  // State to track alternating prioritization
  private recentBassHits = 0;

  constructor(
    config?: Partial<LiveHapticConfig>,
    hapticDriver: HapticDriver = ExpoHaptics,
    vibrationDriver: VibrationDriver = Vibration
  ) {
    this.hapticDriver = hapticDriver;
    this.vibrationDriver = vibrationDriver;

    this.config = {
      enabled: config?.enabled ?? true,
      intensityProfile: config?.intensityProfile ?? 'balanced',
      sensitivityProfile: config?.sensitivityProfile ?? 'normal',
      autoAdaptSensitivity: config?.autoAdaptSensitivity ?? false,
      intensity: config?.intensity ?? 0.8,
      sensitivity: config?.sensitivity ?? 1.0,
      cooldownMs: config?.cooldownMs ?? 45,
      bassThreshold: config?.bassThreshold ?? 0.12,
      transientThreshold: config?.transientThreshold ?? 0.16,
      vocalThreshold: config?.vocalThreshold ?? 0.25,
    };
  }

  private getMonotonicTime(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  public setConfig(update: Partial<LiveHapticConfig>): void {
    this.config = { ...this.config, ...update };
    if (this.config.enabled === false) {
      this.cancelAll();
    }
  }

  public getConfig(): LiveHapticConfig {
    return { ...this.config };
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.cancelAll();
    }
  }

  public setIntensityProfile(profile: HapticIntensityProfile): void {
    this.config.intensityProfile = profile;
  }

  public setSensitivityProfile(profile: AudioSensitivityProfile): void {
    this.config.sensitivityProfile = profile;
  }

  public setAutoAdaptSensitivity(enabled: boolean): void {
    this.config.autoAdaptSensitivity = enabled;
  }

  public cancelAll(): void {
    try {
      this.vibrationDriver.cancel();
    } catch (e) {
      // Driver might not be initialized or platform unsupported
    }
  }

  public reset(): void {
    this.cancelAll();
    this.lastTriggeredAtMs = 0;
    this.totalTriggers = 0;
    this.totalThrottled = 0;
    this.totalSuppressed = 0;
    this.lastTriggerType = 'none';
    this.recentBassHits = 0;
  }

  public getStats(): LiveHapticStats {
    const activeDriverMode: ActuatorDriverMode =
      this.config.intensityProfile === 'strong' ? 'native-vibration' : 'expo-haptics';
    return {
      totalTriggers: this.totalTriggers,
      totalThrottled: this.totalThrottled,
      totalSuppressed: this.totalSuppressed,
      lastTriggerType: this.lastTriggerType,
      activeDriverMode,
    };
  }

  /**
   * Direct manual test trigger for the Haptic Testing Studio.
   * Directly invokes the native actuator according to current intensityProfile,
   * bypassing microphone and audio feature requirements.
   */
  public async testTrigger(type: LiveHapticEventType): Promise<LiveHapticEvent> {
    if (type === 'none') {
      this.cancelAll();
      return this.createDefaultNone(0);
    }

    const now = this.getMonotonicTime();
    const { feedbackStyle, driverMode, durationMs } = this.resolveActuation(type);

    await this.actuate(feedbackStyle, driverMode, durationMs);

    this.lastTriggeredAtMs = now;
    this.totalTriggers++;
    this.lastTriggerType = type;

    return {
      type,
      intensity: 1.0,
      timestamp: now / 1000,
      feedbackStyle,
      driverMode,
      durationMs,
    };
  }

  /**
   * Translates real-time audio features into a tactile haptic actuation.
   * Enforces priority cascading, non-destructive interleaving, and rate cooldowns.
   */
  public async translate(features: LiveAudioFeatures): Promise<LiveHapticEvent> {
    const defaultNone = this.createDefaultNone(features.timestamp);

    if (!this.config.enabled || this.config.intensity <= 0) {
      return defaultNone;
    }

    const now = this.getMonotonicTime();
    const elapsed = now - this.lastTriggeredAtMs;

    // Cooldown safeguard: enforce minimum spacing between vibrations
    if (this.lastTriggeredAtMs > 0 && elapsed < this.config.cooldownMs) {
      this.totalThrottled++;
      return defaultNone;
    }

    // Effective sensitivity scaling
    const sensMultiplier =
      features.effectiveSensitivity > 0
        ? features.effectiveSensitivity
        : this.config.sensitivityProfile === 'high'
        ? 1.8
        : this.config.sensitivityProfile === 'low'
        ? 0.65
        : 1.0;

    const S = Math.max(0.2, sensMultiplier * this.config.sensitivity);

    // Adaptive thresholds based on sensitivity and dynamic noise floor
    const bassCutoff = Math.max(0.04, this.config.bassThreshold / S);
    const transCutoff = Math.max(0.05, this.config.transientThreshold / S);
    const vocalCutoff = Math.max(0.12, this.config.vocalThreshold / S);

    let selectedType: LiveHapticEventType = 'none';
    let rawIntensity = 0;

    // Detection checks
    const hasBassEnergy =
      features.lowEnergy >= bassCutoff &&
      (features.isTransient || features.lowEnergy > features.noiseFloor * 1.5 || features.lowEnergy > features.midEnergy * 0.85);

    const hasPercussionTransient =
      features.isTransient &&
      (features.midEnergy + features.highEnergy >= transCutoff || features.peak >= transCutoff);

    const hasVocalActivity =
      features.vocalActivityEstimate >= vocalCutoff &&
      features.midEnergy >= Math.max(0.03, 0.08 / S) &&
      features.rms >= features.noiseFloor * 1.15;

    const hasMelodicContent =
      features.highEnergy >= Math.max(0.05, 0.16 / S) &&
      features.rms >= Math.max(0.03, 0.08 / S) &&
      features.rms >= features.noiseFloor * 1.25;

    // Non-destructive priority selection:
    // 1. Bass Attack / Kick
    if (hasBassEnergy) {
      // If we recently fired multiple bass pulses and vocal activity is prominent, give slot to vocal
      if (this.recentBassHits >= 2 && hasVocalActivity && !features.isTransient) {
        selectedType = 'vocal_pulse';
        rawIntensity = features.vocalActivityEstimate;
        this.recentBassHits = 0;
      } else {
        selectedType = 'bass_punch';
        rawIntensity = features.lowEnergy;
        this.recentBassHits++;
      }
    }
    // 2. Percussion Snap (Snare / Clap / Rimshot)
    else if (hasPercussionTransient) {
      selectedType = 'percussion_snap';
      rawIntensity = features.peak;
      this.recentBassHits = 0;
    }
    // 3. Vocal-Range Pulse (Singing / Lead Voice)
    else if (hasVocalActivity) {
      selectedType = 'vocal_pulse';
      rawIntensity = features.vocalActivityEstimate;
      this.recentBassHits = 0;
    }
    // 4. Melodic Sparkle (Cymbals / Lead Synth / Guitar Solo)
    else if (hasMelodicContent) {
      selectedType = 'melody_tick';
      rawIntensity = features.highEnergy;
      this.recentBassHits = 0;
    }

    if (selectedType === 'none') {
      this.totalSuppressed++;
      return defaultNone;
    }

    const { feedbackStyle, driverMode, durationMs } = this.resolveActuation(selectedType);

    // Execute physical vibration
    this.lastTriggeredAtMs = now;
    this.totalTriggers++;
    this.lastTriggerType = selectedType;

    await this.actuate(feedbackStyle, driverMode, durationMs);

    return {
      type: selectedType,
      intensity: Math.min(1.0, rawIntensity * this.config.intensity),
      timestamp: features.timestamp,
      feedbackStyle,
      driverMode,
      durationMs,
    };
  }

  /**
   * Resolves the physical actuation pattern and duration based on selected event and intensityProfile.
   */
  private resolveActuation(type: LiveHapticEventType): {
    feedbackStyle: LiveHapticFeedbackStyle;
    driverMode: ActuatorDriverMode;
    durationMs: number;
  } {
    const profile = this.config.intensityProfile;

    if (profile === 'strong') {
      switch (type) {
        case 'bass_punch':
          return { feedbackStyle: 'strong_bass', driverMode: 'native-vibration', durationMs: 60 };
        case 'percussion_snap':
          return { feedbackStyle: 'strong_percussion', driverMode: 'native-vibration', durationMs: 30 };
        case 'vocal_pulse':
          return { feedbackStyle: 'strong_vocal', driverMode: 'native-vibration', durationMs: 18 };
        case 'melody_tick':
          return { feedbackStyle: 'strong_melody', driverMode: 'native-vibration', durationMs: 30 };
        default:
          return { feedbackStyle: 'none', driverMode: 'native-vibration', durationMs: 0 };
      }
    } else if (profile === 'subtle') {
      switch (type) {
        case 'bass_punch':
          return { feedbackStyle: 'medium', driverMode: 'expo-haptics', durationMs: 43 };
        case 'percussion_snap':
          return { feedbackStyle: 'light', driverMode: 'expo-haptics', durationMs: 30 };
        case 'vocal_pulse':
          return { feedbackStyle: 'selection', driverMode: 'expo-haptics', durationMs: 20 };
        case 'melody_tick':
          return { feedbackStyle: 'selection', driverMode: 'expo-haptics', durationMs: 20 };
        default:
          return { feedbackStyle: 'none', driverMode: 'expo-haptics', durationMs: 0 };
      }
    } else {
      // Balanced
      switch (type) {
        case 'bass_punch':
          return { feedbackStyle: 'heavy', driverMode: 'expo-haptics', durationMs: 60 };
        case 'percussion_snap':
          return { feedbackStyle: 'medium', driverMode: 'expo-haptics', durationMs: 43 };
        case 'vocal_pulse':
          return { feedbackStyle: 'light', driverMode: 'expo-haptics', durationMs: 30 };
        case 'melody_tick':
          return { feedbackStyle: 'selection', driverMode: 'expo-haptics', durationMs: 20 };
        default:
          return { feedbackStyle: 'none', driverMode: 'expo-haptics', durationMs: 0 };
      }
    }
  }

  /**
   * Executes the physical vibration on the selected hardware driver.
   */
  private async actuate(
    feedbackStyle: LiveHapticFeedbackStyle,
    driverMode: ActuatorDriverMode,
    durationMs: number
  ): Promise<void> {
    try {
      if (driverMode === 'native-vibration') {
        if (feedbackStyle === 'strong_bass') {
          this.vibrationDriver.vibrate(60);
        } else if (feedbackStyle === 'strong_percussion') {
          this.vibrationDriver.vibrate(30);
        } else if (feedbackStyle === 'strong_vocal') {
          this.vibrationDriver.vibrate(18);
        } else if (feedbackStyle === 'strong_melody') {
          this.vibrationDriver.vibrate([0, 15, 30, 15]);
        }
      } else {
        // expo-haptics driver
        if (feedbackStyle === 'heavy') {
          await this.hapticDriver.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy);
        } else if (feedbackStyle === 'medium') {
          await this.hapticDriver.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
        } else if (feedbackStyle === 'light') {
          await this.hapticDriver.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
        } else if (feedbackStyle === 'selection') {
          await this.hapticDriver.selectionAsync();
        }
      }
    } catch (e) {
      console.warn('[LiveHapticTranslator] Actuation error:', e);
    }
  }

  private createDefaultNone(timestamp: number): LiveHapticEvent {
    const driverMode: ActuatorDriverMode =
      this.config.intensityProfile === 'strong' ? 'native-vibration' : 'expo-haptics';
    return {
      type: 'none',
      intensity: 0,
      timestamp,
      feedbackStyle: 'none',
      driverMode,
      durationMs: 0,
    };
  }
}
