/**
 * ExpoAudioEngine
 *
 * Concrete implementation of the AudioEngine contract powered by `expo-audio`.
 * Enforces the critical architectural rule: The audio playback position is the
 * single authoritative clock for all future sensory systems (lyrics, visuals, haptics).
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

  private clock: PlaybackClock = {
    positionMs: 0,
    durationMs: 0,
    status: 'idle',
    rate: 1.0,
    isBuffering: false,
    errorMessage: null,
  };

  private lastNotifiedStatus: PlaybackStatus = 'idle';
  private clockListeners = new Set<AudioEngineListener>();
  private statusListeners = new Set<AudioStatusListener>();

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
      this.updateStatus('stopped');
      this.notifyClock();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.handleError(`Stop failed: ${message}`);
    }
  }

  /**
   * Seek to a target timestamp in milliseconds.
   */
  public async seek(positionMs: number): Promise<void> {
    if (!this.player) return;

    const clampedMs = Math.max(0, Math.min(positionMs, this.clock.durationMs || positionMs));
    const targetSeconds = clampedMs / 1000;

    try {
      await this.player.seekTo(targetSeconds);
      // Immediately reflect seeked position on the authoritative clock
      this.clock.positionMs = clampedMs;
      this.notifyClock();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.handleError(`Seek to ${positionMs}ms failed: ${message}`);
    }
  }

  /**
   * Unload player and release resources.
   */
  public async unload(): Promise<void> {
    this.cleanupPlayer();
    this.clock = {
      positionMs: 0,
      durationMs: 0,
      status: 'idle',
      rate: 1.0,
      isBuffering: false,
      errorMessage: null,
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

    this.clock.positionMs = posMs;
    if (durMs > 0) {
      this.clock.durationMs = durMs;
    }
    this.clock.isBuffering = status.isBuffering ?? false;
    this.clock.rate = status.playbackRate || 1.0;

    if (status.didJustFinish) {
      this.clock.positionMs = this.clock.durationMs;
      this.updateStatus('stopped');
    } else if (status.isLoaded) {
      if (status.playing) {
        this.updateStatus('playing');
      } else if (this.clock.status !== 'stopped' && this.clock.status !== 'loading') {
        this.updateStatus('paused');
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
