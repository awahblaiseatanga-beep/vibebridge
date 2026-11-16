/**
 * Types & Contracts for Audio Engine
 */

import { PlaybackClock, PlaybackStatus } from '@/types';

export type BundledAudioSource = {
  type: 'bundle';
  assetId: number;
  name?: string;
  durationMs?: number;
};

export type UriAudioSource = {
  type: 'uri';
  uri: string;
  name?: string;
  durationMs?: number;
};

export type AudioSourceInput = BundledAudioSource | UriAudioSource | number | string;

export type AudioEngineListener = (clock: PlaybackClock) => void;
export type AudioStatusListener = (status: PlaybackStatus) => void;

export interface AudioEngine {
  /**
   * Load an audio source (bundled asset or local/remote URI).
   * Transitions status: idle/stopped -> loading -> paused (ready).
   */
  load(source: AudioSourceInput): Promise<void>;

  /**
   * Start playback from current position.
   */
  play(): Promise<void>;

  /**
   * Pause playback at current position.
   */
  pause(): Promise<void>;

  /**
   * Resume playback from paused state.
   */
  resume(): Promise<void>;

  /**
   * Stop playback and reset position to 0.
   */
  stop(): Promise<void>;

  /**
   * Seek to a target timestamp in milliseconds.
   */
  seek(positionMs: number): Promise<void>;

  /**
   * Unload current audio resource and reset state to idle.
   */
  unload(): Promise<void>;

  /**
   * Authoritative clock query.
   * Returns current position, duration, and status.
   */
  getClock(): PlaybackClock;

  /**
   * Subscribe to high-frequency clock updates.
   * Used as the master clock for the Synchronization Engine.
   */
  onClockUpdate(callback: AudioEngineListener): () => void;

  /**
   * Subscribe to discrete playback status transitions (loading, playing, paused, stopped, error).
   */
  onStatusChange(callback: AudioStatusListener): () => void;
}
