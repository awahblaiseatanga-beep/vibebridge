/**
 * Feature: Playback
 *
 * Responsibilities:
 * - Transport controls (Play, Pause, Resume, Stop, Seek).
 * - Playback progress bar and timestamp display.
 * - Integration point for audio engine and sensory synchronization.
 */

export * from './usePlayback';
export * from './components/NowPlayingCard';

export interface PlaybackFeatureConfig {
  autoPlay: boolean;
  loop: boolean;
}
