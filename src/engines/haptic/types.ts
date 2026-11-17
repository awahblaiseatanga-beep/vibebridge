/**
 * Haptic Engine Types & Contracts
 *
 * Defines tactile patterns, intensity scaling, throttle configurations,
 * and interface contracts for physical haptic actuation.
 */

import { DispatchedEvent } from '@/engines/synchronization';
import { IEventScheduler } from '@/engines/event-scheduler';

/**
 * Standard tactile pattern types mapped to musical events.
 */
export type HapticPattern =
  | 'heavy'    // Downbeats, heavy bass kicks, sub-bass impacts
  | 'medium'   // Mid-range beats, snares, rimshots
  | 'light'    // Hi-hats, subtle rhythm pulses, subdivisions
  | 'soft'     // Very gentle background rhythm cues
  | 'rigid'    // Sharp accents, staccato hits
  | 'pulse'    // Notification-style feedback pulse
  | 'double'   // Double beat / secondary hit
  | 'silence';  // Rest / muted beat

/**
 * Payload data delivered with a 'haptic' sensory cue event.
 */
export interface HapticCuePayload {
  pattern: HapticPattern;
  /** Relative event intensity weight from 0.0 to 1.0 (defaults to 1.0) */
  weight?: number;
  /** Optional human-readable description for debugging / screen readers */
  label?: string;
}

export type HapticCueEvent = DispatchedEvent<HapticCuePayload>;

/**
 * Configuration options for the HapticEngine.
 */
export interface HapticEngineConfig {
  /** Master enable switch for tactile output. Default: true */
  enabled?: boolean;
  /**
   * Global user logical intensity multiplier from 0.0 to 1.0. Default: 1.0.
   * Represents logical intensity levels mapped to available Expo Haptics feedback styles.
   * Does not guarantee corresponding physical vibration amplitude percentages across Android devices.
   */
  intensity?: number;
  /**
   * Minimum interval between consecutive physical vibrations in milliseconds.
   * Serves as an event-rate safeguard to limit dense trigger bursts.
   * Does NOT claim or guarantee protection against physical motor overheating or hardware fatigue.
   * Default: 40ms.
   */
  minIntervalMs?: number;
}

/**
 * State snapshot of the HapticEngine.
 */
export interface HapticEngineState {
  enabled: boolean;
  intensity: number;
  minIntervalMs: number;
  lastTriggeredAtMs: number;
  totalVibrationsTriggered: number;
  totalVibrationsThrottled: number;
}

/**
 * Interface contract for HapticEngine implementations.
 */
export interface IHapticEngine {
  /**
   * Master enable or disable tactile feedback.
   */
  setEnabled(enabled: boolean): void;

  /**
   * Set user intensity multiplier [0.0 - 1.0].
   */
  setIntensity(intensity: number): void;

  /**
   * Set minimum interval between physical pulses [ms].
   */
  setMinIntervalMs(intervalMs: number): void;

  /**
   * Trigger a haptic pulse immediately with the specified pattern and weight.
   */
  trigger(pattern: HapticPattern, weight?: number): Promise<boolean>;

  /**
   * Subscribe to the Master Event Scheduler's 'haptic' channel.
   */
  attachScheduler(scheduler: IEventScheduler): void;

  /**
   * Unsubscribe from the Master Event Scheduler.
   */
  detachScheduler(): void;

  /**
   * Query current engine state snapshot.
   */
  getState(): HapticEngineState;

  /**
   * Reset throttling timestamps, statistics, and queued actions.
   */
  reset(): void;

  /**
   * Completely dispose the engine.
   */
  dispose(): void;
}
