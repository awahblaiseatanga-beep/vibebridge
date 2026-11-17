/**
 * Feature: Haptics (FEEL Pillar)
 *
 * Responsibilities:
 * - Haptic configuration UI (intensity selection, pattern testing).
 * - Real-time haptic channel toggle and intensity scaling.
 * - Reactive integration with the Haptic Engine and Priority Event Scheduler.
 */

export interface HapticsFeatureSettings {
  enabled: boolean;
  intensity: number; // 0.0 to 1.0
  fallbackMode: 'simple' | 'complex';
}

export * from './useHaptics';
export * from './demoTrackHaptics';
export * from './components/HapticControlCard';
