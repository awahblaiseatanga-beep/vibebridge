/**
 * Feature: Haptics (FEEL Pillar)
 *
 * Responsibilities:
 * - Haptic configuration UI (intensity slider, pattern selection).
 * - Real-time haptic channel toggle and intensity scaling.
 * - Integration with the Haptic Engine.
 *
 * Status: Foundation milestone.
 */

export interface HapticsFeatureSettings {
  enabled: boolean;
  intensity: number; // 0.0 to 1.0
  fallbackMode: 'simple' | 'complex';
}
