/**
 * Engine: Haptic (FEEL Pillar)
 *
 * Responsibilities:
 * - Translates scheduled HapticCue events into device tactile vibrations.
 * - Initial implementation targeted for Expo Haptics.
 * - Abstracted to allow drop-in replacement with a custom native Android vibration module
 *   (e.g., android.os.Vibrator / VibrationEffect) if more granular amplitude control is required.
 *
 * Status: Interface defined.
 */

import { HapticCue } from '@/types';

export interface HapticEngine {
  triggerCue(cue: HapticCue): Promise<void>;
  stopAll(): Promise<void>;
  isSupported(): Promise<boolean>;
  setIntensityMultiplier(multiplier: number): void;
}
