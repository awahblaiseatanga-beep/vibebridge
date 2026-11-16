/**
 * Feature: Settings
 *
 * Responsibilities:
 * - Sensory channel preferences (enable/disable READ, SEE, FEEL).
 * - Accessibility configurations (contrast, text scaling).
 * - Application diagnostic information and version details.
 *
 * Status: Foundation milestone.
 */

export interface SettingsPreferences {
  highContrast: boolean;
  hapticEnabled: boolean;
  hapticStrength: number;
  lyricsTextScale: number;
}
