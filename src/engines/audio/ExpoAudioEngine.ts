/**
 * ExpoAudioEngine
 *
 * Concrete implementation of the AudioEngine contract powered by `expo-audio`.
 * Enforces the critical architectural rule: The audio playback position is the
 * single authoritative clock for all future sensory systems (lyrics, visuals, haptics).
 *
 * Prepared for Master Synchronization Engine:
 * - Monotonic timestamp anchoring (`updatedAtMs` via `performance.now()`).
 * - Timeline revision generation counter (`timelineRevision`).
 * - Safe forward estimation method (`getEstimatedPositionMs()`) that never mutates native timestamps.
 * - Coalesced rapid-seeking serialization preventing out-of-order race conditions.
 * - Robust native interruption and audio focus handling.
 */

import {
  createAudioPlayer,
  AudioPlayer,
  AudioSource,
  AudioStatus,
} from 'expo-audio';
import { PlaybackClock, PlaybackStatus } from '@/types';
import {
  AudioEngine,
  AudioEngineListener,
  AudioSourceInput,
  AudioStatusListener,
} from './types';

export class ExpoAudioEngine implements AudioEngine {
  private player: AudioPlayer | null = null;
  private statusSubscription: { remove: () => void } | null = null;

  // Timeline revision counter incremented on track load and seek
  private timelineRevision = 0;

  // Rapid-seeking serialization & coalescing state
  private isSeekingNative = false;
  private pendingSeekTargetSec: number | null = null;

  private clock: PlaybackClock = {
    positionMs: 0,
    durationMs: 0,
    status: 'idle',
    rate: 1.0,
    isBuffering: false,
    errorMessage: null,
    updatedAtMs: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    timelineRevision: 0,
  };

  private lastNotifiedStatus: PlaybackStatus = 'idle';
  private clockListeners = new Set<AudioEngineListener>();
  private statusListeners = new Set<AudioStatusListener>();

  /**
   * Helper returning monotonic timestamp in milliseconds.
   */
  private getMonotonicTime(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /**
   * Resolves an AudioSourceInput to the native AudioSource required by expo-audio.
   */
  private resolveSource(input: AudioSourceInput): AudioSource {
    if (typeof input === 'number') {
      return input;
    }
    if (typeof input === 'string') {
      return { uri: input };
    }
    if (input.type === 'bundle') {
      return input.assetId;
    }
    if (input.type === 'uri') {
      return { uri: input.uri };
    }
    throw new Error('Unsupported audio source input format.');
  }

  /**
   * Load an audio source (bundled asset or local URI).
   */
  public async load(source: AudioSourceInput): Promise<void> {
    try {
      this.updateStatus('loading');
      this.clock.errorMessage = null;

      // Clean up previous player instance if any
      this.cleanupPlayer();

      // Reset seek queue
      this.isSeekingNative = false;
      this.pendingSeekTargetSec = null;

      // Increment timeline revision for new track
      this.timelineRevision++;
      this.clock.timelineRevision = this.timelineRevision;
      this.clock.positionMs = 0;
      this.clock.updatedAtMs = this.getMonotonicTime();

      const nativeSource = this.resolveSource(source);

      // Create new player with 50ms update interval for tight sensory synchronization
      this.player = createAudioPlayer(nativeSource, {
        updateInterval: 50,
        keepAudioSessionActive: true,
      });

      // Subscribe to real-time status updates from native player
      this.statusSubscription = this.player.addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => {
          this.handleNativeStatusUpdate(status);
        }
      );

      // Pre-populate duration if provided in input
      if (typeof source === 'object' && source !== null && 'durationMs' in source && source.durationMs) {
        this.clock.durationMs = source.durationMs;
      }

      // Initial transition to paused (ready to play)
      this.updateStatus('paused');
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.notifyClock();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.handleError(`Failed to load audio source: ${message}`);
      throw err;
    }
  }

  /**
   * Play audio from current position.
   */
  public async play(): Promise<void> {
    if (!this.player) {
      this.handleError('Cannot play: No audio player loaded.');
      return;
    }

    try {
      this.player.play();
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.updateStatus('playing');
      this.notifyClock();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.handleError(`Playback start failed: ${message}`);
    }
  }

  /**
   * Pause audio playback.
   */
  public async pause(): Promise<void> {
    if (!this.player) return;

    try {
      this.player.pause();
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.updateStatus('paused');
      this.notifyClock();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.handleError(`Pause failed: ${message}`);
    }
  }

  /**
   * Resume audio playback from paused state.
   */
  public async resume(): Promise<void> {
    return this.play();
  }

  /**
   * Stop audio playback and reset playback clock to zero.
   */
  public async stop(): Promise<void> {
    if (!this.player) return;

    try {
      this.player.pause();
      await this.player.seekTo(0);
      this.clock.positionMs = 0;
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.updateStatus('stopped');
      this.notifyClock();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.handleError(`Stop failed: ${message}`);
    }
  }

  /**
   * Seek to a target timestamp in milliseconds.
   * Utilizes request coalescing to prevent rapid repeated seeks from clobbering state.
   */
  public async seek(positionMs: number): Promise<void> {
    if (!this.player) return;

    const clampedMs = Math.max(0, Math.min(positionMs, this.clock.durationMs || positionMs));
    const targetSeconds = clampedMs / 1000;

    // Increment timeline revision on seek to invalidate downstream cues
    this.timelineRevision++;
    this.clock.timelineRevision = this.timelineRevision;
    this.clock.positionMs = clampedMs;
    this.clock.updatedAtMs = this.getMonotonicTime();
    this.notifyClock();

    await this.dispatchNativeSeek(targetSeconds);
  }

  /**
   * Serialized/coalesced native seek dispatcher.
   */
  private async dispatchNativeSeek(targetSeconds: number): Promise<void> {
    if (this.isSeekingNative) {
      // Coalesce: save latest target; executed when in-flight seek completes
      this.pendingSeekTargetSec = targetSeconds;
      return;
    }

    this.isSeekingNative = true;
    this.pendingSeekTargetSec = null;

    try {
      let currentTarget = targetSeconds;
      while (this.player) {
        await this.player.seekTo(currentTarget);

        // If another seek was requested while this one was executing, continue with newest
        if (this.pendingSeekTargetSec !== null) {
          currentTarget = this.pendingSeekTargetSec;
          this.pendingSeekTargetSec = null;
          continue;
        }
        break;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.handleError(`Seek failed: ${message}`);
    } finally {
      this.isSeekingNative = false;
    }
  }

  /**
   * Safe clock estimation method.
   * Computes the current estimated playback position in milliseconds.
   * - When playing, projects forward from the last authoritative native timestamp
   *   using performance.now() and playback rate.
   * - When paused, stopped, buffering, or idle, returns exact positionMs.
   * - Clamped strictly to [0, durationMs].
   * - Does not mutate native positionMs.
   */
  public getEstimatedPositionMs(atTimeMs?: number): number {
    const now = typeof atTimeMs === 'number' ? atTimeMs : this.getMonotonicTime();

    // Clock estimation NEVER advances while paused, stopped, buffering, idle, or completed
    if (
      this.clock.status !== 'playing' ||
      this.clock.isBuffering ||
      this.clock.durationMs <= 0
    ) {
      return this.clock.positionMs;
    }

    const elapsedMs = Math.max(0, now - this.clock.updatedAtMs);
    const projectedMs = this.clock.positionMs + (elapsedMs * (this.clock.rate || 1.0));

    // Clamp strictly to [0, durationMs]
    return Math.max(0, Math.min(Math.round(projectedMs), this.clock.durationMs));
  }

  /**
   * Unload player and release resources.
   */
  public async unload(): Promise<void> {
    this.cleanupPlayer();
    this.isSeekingNative = false;
    this.pendingSeekTargetSec = null;
    this.clock = {
      positionMs: 0,
      durationMs: 0,
      status: 'idle',
      rate: 1.0,
      isBuffering: false,
      errorMessage: null,
      updatedAtMs: this.getMonotonicTime(),
      timelineRevision: 0,
    };
    this.updateStatus('idle');
    this.notifyClock();
  }

  /**
   * Authoritative clock query.
   */
  public getClock(): PlaybackClock {
    return { ...this.clock };
  }

  /**
   * Subscribe to high-frequency clock updates.
   */
  public onClockUpdate(callback: AudioEngineListener): () => void {
    this.clockListeners.add(callback);
    // Send immediate initial tick
    callback(this.getClock());
    return () => {
      this.clockListeners.delete(callback);
    };
  }

  /**
   * Subscribe to discrete playback status transitions.
   */
  public onStatusChange(callback: AudioStatusListener): () => void {
    this.statusListeners.add(callback);
    callback(this.clock.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Handles incoming native status ticks from expo-audio.
   */
  private handleNativeStatusUpdate(status: AudioStatus): void {
    if (status.error) {
      this.handleError(status.error);
      return;
    }

    const posMs = Math.round((status.currentTime || 0) * 1000);
    const durMs = Math.round((status.duration || 0) * 1000);

    // Only update positionMs if not actively seeking natively (prevents backwards jump before seek lands)
    if (!this.isSeekingNative) {
      this.clock.positionMs = posMs;
      this.clock.updatedAtMs = this.getMonotonicTime();
    }

    if (durMs > 0) {
      this.clock.durationMs = durMs;
    }
    this.clock.isBuffering = status.isBuffering ?? false;
    this.clock.rate = status.playbackRate || 1.0;

    if (status.didJustFinish) {
      this.clock.positionMs = this.clock.durationMs;
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.updateStatus('stopped');
    } else if (status.isLoaded) {
      if (status.playing) {
        if (this.clock.status !== 'playing') {
          this.clock.updatedAtMs = this.getMonotonicTime();
        }
        this.updateStatus('playing');
      } else {
        // Native reports playing == false (e.g. paused by user or interrupted by audio focus loss / headphones unplugged)
        if (this.clock.status === 'playing') {
          this.clock.updatedAtMs = this.getMonotonicTime();
          this.updateStatus('paused');
        } else if (this.clock.status !== 'stopped' && this.clock.status !== 'loading') {
          this.updateStatus('paused');
        }
      }
    }

    this.notifyClock();
  }

  private updateStatus(newStatus: PlaybackStatus): void {
    this.clock.status = newStatus;
    if (this.lastNotifiedStatus !== newStatus) {
      this.lastNotifiedStatus = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('[AudioEngine] Status listener error:', e);
        }
      });
    }
  }

  private handleError(message: string): void {
    console.error(`[AudioEngine Error]: ${message}`);
    this.clock.errorMessage = message;
    this.clock.updatedAtMs = this.getMonotonicTime();
    this.updateStatus('error');
    this.notifyClock();
  }

  private notifyClock(): void {
    const currentClock = this.getClock();
    this.clockListeners.forEach((listener) => {
      try {
        listener(currentClock);
      } catch (e) {
        console.error('[AudioEngine] Clock listener error:', e);
      }
    });
  }

  private cleanupPlayer(): void {
    if (this.statusSubscription) {
      this.statusSubscription.remove();
      this.statusSubscription = null;
    }
    if (this.player) {
      try {
        this.player.remove();
      } catch (e) {
        console.warn('[AudioEngine] Warning during player removal:', e);
      }
      this.player = null;
    }
  }
}

// Global authoritative AudioEngine singleton
export const audioEngine: AudioEngine = new ExpoAudioEngine();
