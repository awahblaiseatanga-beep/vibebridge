/**
 * MasterClock
 *
 * Central timing distribution orchestrator that wraps the underlying AudioEngine.
 * Exposes continuous estimated timecode while maintaining native hardware playback
 * position as the authoritative ground truth.
 */

import { audioEngine as defaultAudioEngine, AudioEngine } from '@/engines/audio';
import { PlaybackClock, PlaybackStatus } from '@/types';
import { MasterClock as IMasterClock } from './types';

export class AudioMasterClock implements IMasterClock {
  private engine: AudioEngine;

  constructor(engine: AudioEngine = defaultAudioEngine) {
    this.engine = engine;
  }

  /**
   * Continuous timeline estimation using monotonic anchoring and playback rate.
   * Clamped strictly to [0, durationMs].
   * Does not advance while paused, stopped, buffering, or idle.
   */
  public getEstimatedPositionMs(atTimeMs?: number): number {
    return this.engine.getEstimatedPositionMs(atTimeMs);
  }

  /**
   * Returns current authoritative PlaybackClock snapshot from native engine.
   */
  public getClock(): PlaybackClock {
    return this.engine.getClock();
  }

  /**
   * Subscribe to authoritative clock updates.
   */
  public onClockUpdate(callback: (clock: PlaybackClock) => void): () => void {
    return this.engine.onClockUpdate(callback);
  }

  /**
   * Subscribe to discrete playback status changes.
   */
  public onStatusChange(callback: (status: PlaybackStatus) => void): () => void {
    return this.engine.onStatusChange(callback);
  }
}

export const masterClock: IMasterClock = new AudioMasterClock();
