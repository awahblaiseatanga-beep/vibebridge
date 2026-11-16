/**
 * Engine: Audio
 *
 * Responsibilities:
 * - Direct interface with Expo Audio (or underlying native audio drivers).
 * - Master audio playback state machine (idle -> loading -> playing -> paused -> stopped).
 * - Emitting high-frequency position ticks to the Synchronization Engine.
 *
 * Status: Interface defined. Playback implementation scheduled for Milestone 2.
 */

import { PlaybackClock, PlaybackStatus } from '@/types';

export interface AudioEngine {
  load(uri: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  stop(): Promise<void>;
  unload(): Promise<void>;
  getClock(): PlaybackClock;
  onStatusUpdate(callback: (status: PlaybackStatus) => void): () => void;
  onPositionUpdate(callback: (positionMs: number) => void): () => void;
}
