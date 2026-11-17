/**
 * ExpoHapticEngine
 *
 * Concrete implementation of IHapticEngine using expo-haptics.
 * Implements:
 * 1. Master enable/disable toggle with dynamic scheduler subscription suspension/restoration.
 * 2. User-adjustable logical intensity scaling (0.0 to 1.0) with dynamic tactile tier remapping.
 * 3. Event-rate safeguard (minIntervalMs: 40ms) to limit overly dense trigger bursts.
 * 4. Reactive subscription to PriorityEventScheduler's 'haptic' channel (zero independent timers).
 * 5. Injectable HapticDriver for deterministic automated testing.
 */

import * as ExpoHaptics from 'expo-haptics';
import { IEventScheduler } from '@/engines/event-scheduler';
import {
  HapticCueEvent,
  HapticEngineConfig,
  HapticEngineState,
  HapticPattern,
  IHapticEngine,
} from './types';

/**
 * Driver interface wrapping the low-level platform haptics API.
 * Allows dependency injection for tests and future native custom modules.
 */
export interface HapticDriver {
  impactAsync(style: ExpoHaptics.ImpactFeedbackStyle): Promise<void>;
  notificationAsync(type: ExpoHaptics.NotificationFeedbackType): Promise<void>;
  selectionAsync(): Promise<void>;
}

export class ExpoHapticEngine implements IHapticEngine {
  private driver: HapticDriver;
  private enabled: boolean;
  private intensity: number;
  private minIntervalMs: number;

  private lastTriggeredAtMs = 0;
  private totalVibrationsTriggered = 0;
  private totalVibrationsThrottled = 0;

  private schedulerUnsubscribe: (() => void) | null = null;
  private activeScheduler: IEventScheduler | null = null;

  constructor(config?: HapticEngineConfig, driver: HapticDriver = ExpoHaptics) {
    this.driver = driver;
    this.enabled = config?.enabled ?? true;
    this.intensity = Math.max(0, Math.min(1, config?.intensity ?? 1.0));
    this.minIntervalMs = config?.minIntervalMs ?? 40;
  }

  private getMonotonicTime(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // Suspend scheduler subscription when disabled to avoid unnecessary processing
      if (this.schedulerUnsubscribe) {
        this.schedulerUnsubscribe();
        this.schedulerUnsubscribe = null;
      }
    } else {
      // Restore scheduler subscription if an active scheduler was attached
      if (this.activeScheduler && !this.schedulerUnsubscribe) {
        this.subscribeToScheduler(this.activeScheduler);
      }
    }
  }

  public setIntensity(intensity: number): void {
    this.intensity = Math.max(0, Math.min(1, intensity));
  }

  public setMinIntervalMs(intervalMs: number): void {
    this.minIntervalMs = Math.max(0, intervalMs);
  }

  public getState(): HapticEngineState {
    return {
      enabled: this.enabled,
      intensity: this.intensity,
      minIntervalMs: this.minIntervalMs,
      lastTriggeredAtMs: this.lastTriggeredAtMs,
      totalVibrationsTriggered: this.totalVibrationsTriggered,
      totalVibrationsThrottled: this.totalVibrationsThrottled,
    };
  }

  public reset(): void {
    this.lastTriggeredAtMs = 0;
    this.totalVibrationsTriggered = 0;
    this.totalVibrationsThrottled = 0;
  }

  /**
   * Evaluates pattern and effective intensity, applying dynamic tier remapping
   * to adapt discrete Expo Haptics feedback styles to continuous volume/intensity levels.
   */
  private resolveImpactStyle(
    pattern: HapticPattern,
    effectiveIntensity: number
  ): ExpoHaptics.ImpactFeedbackStyle | null {
    if (effectiveIntensity <= 0 || pattern === 'silence') {
      return null;
    }

    switch (pattern) {
      case 'heavy':
        if (effectiveIntensity >= 0.8) return ExpoHaptics.ImpactFeedbackStyle.Heavy;
        if (effectiveIntensity >= 0.5) return ExpoHaptics.ImpactFeedbackStyle.Medium;
        if (effectiveIntensity >= 0.25) return ExpoHaptics.ImpactFeedbackStyle.Light;
        return ExpoHaptics.ImpactFeedbackStyle.Soft;

      case 'medium':
        if (effectiveIntensity >= 0.6) return ExpoHaptics.ImpactFeedbackStyle.Medium;
        if (effectiveIntensity >= 0.3) return ExpoHaptics.ImpactFeedbackStyle.Light;
        return ExpoHaptics.ImpactFeedbackStyle.Soft;

      case 'light':
        if (effectiveIntensity >= 0.4) return ExpoHaptics.ImpactFeedbackStyle.Light;
        return ExpoHaptics.ImpactFeedbackStyle.Soft;

      case 'soft':
        return ExpoHaptics.ImpactFeedbackStyle.Soft;

      case 'rigid':
        if (effectiveIntensity >= 0.5) return ExpoHaptics.ImpactFeedbackStyle.Rigid;
        return ExpoHaptics.ImpactFeedbackStyle.Light;

      default:
        return ExpoHaptics.ImpactFeedbackStyle.Medium;
    }
  }

  /**
   * Primary tactile actuation trigger.
   * Returns true if a physical vibration was sent to the driver, or false if bypassed/throttled.
   */
  public async trigger(pattern: HapticPattern, weight: number = 1.0): Promise<boolean> {
    if (!this.enabled || pattern === 'silence') {
      return false;
    }

    const effectiveIntensity = this.intensity * Math.max(0, Math.min(1, weight));
    if (effectiveIntensity <= 0) {
      return false;
    }

    // Event-rate safeguard: limit rapid consecutive trigger bursts
    const now = this.getMonotonicTime();
    if (this.lastTriggeredAtMs > 0 && now - this.lastTriggeredAtMs < this.minIntervalMs) {
      this.totalVibrationsThrottled++;
      return false;
    }

    this.lastTriggeredAtMs = now;
    this.totalVibrationsTriggered++;

    try {
      if (pattern === 'pulse') {
        await this.driver.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
        return true;
      }

      if (pattern === 'double') {
        await this.driver.selectionAsync();
        return true;
      }

      const impactStyle = this.resolveImpactStyle(pattern, effectiveIntensity);
      if (!impactStyle) {
        return false;
      }

      await this.driver.impactAsync(impactStyle);
      return true;
    } catch (err) {
      // In web or environments without vibration hardware, fail silently without crashing
      return false;
    }
  }

  /**
   * Helper to bind subscription to the scheduler's 'haptic' channel without duplication.
   */
  private subscribeToScheduler(scheduler: IEventScheduler): void {
    if (this.schedulerUnsubscribe) {
      this.schedulerUnsubscribe();
      this.schedulerUnsubscribe = null;
    }
    this.schedulerUnsubscribe = scheduler.subscribe<HapticCueEvent['payload']>(
      'haptic',
      (event) => {
        const payload = event.payload;
        if (payload && payload.pattern) {
          this.trigger(payload.pattern, payload.weight ?? 1.0);
        }
      }
    );
  }

  /**
   * Attaches to the Master Event Scheduler's 'haptic' channel.
   * All sensory timings are governed by the scheduler; this engine has NO independent clock.
   */
  public attachScheduler(scheduler: IEventScheduler): void {
    this.activeScheduler = scheduler;
    if (this.enabled) {
      this.subscribeToScheduler(scheduler);
    }
  }

  public detachScheduler(): void {
    if (this.schedulerUnsubscribe) {
      this.schedulerUnsubscribe();
      this.schedulerUnsubscribe = null;
    }
    this.activeScheduler = null;
  }

  public dispose(): void {
    this.detachScheduler();
    this.reset();
  }
}

export const hapticEngine: IHapticEngine = new ExpoHapticEngine();
