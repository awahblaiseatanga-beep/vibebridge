/**
 * Engine: Audio
 *
 * Responsibilities:
 * - Direct interface with Expo Audio native subsystem.
 * - Master audio playback state machine (idle -> loading -> paused -> playing -> stopped -> error).
 * - Serves as the authoritative master clock for all future sensory systems (lyrics, visuals, haptics).
 */

export * from './types';
export * from './ExpoAudioEngine';
