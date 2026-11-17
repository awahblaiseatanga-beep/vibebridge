/**
 * Engine: Haptic (FEEL Pillar)
 *
 * Responsibilities:
 * - Dedicated physical tactile actuation engine.
 * - Reactive subscriber to PriorityEventScheduler's 'haptic' channel.
 * - Dynamic tier remapping based on user-adjustable intensity and event weight.
 * - Anti-spam throttling to prevent motor fatigue.
 * - Abstracted to allow drop-in replacement with a custom native Android vibration module
 *   (e.g., android.os.Vibrator / VibrationEffect) if more granular amplitude control is required.
 */

export * from './types';
export * from './ExpoHapticEngine';
