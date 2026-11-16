/**
 * Global State Management Store
 *
 * Responsibilities:
 * - Centralized application state (active track, playback status, sensory settings).
 * - Keep state predictable, low-latency, and decoupled from platform rendering.
 *
 * Status: Foundation milestone.
 */

import { PlaybackStatus, TrackMetadata, SensoryPillarConfig } from '@/types';

export interface AppState {
  currentTrack: TrackMetadata | null;
  playbackStatus: PlaybackStatus;
  sensoryConfig: SensoryPillarConfig;
}
