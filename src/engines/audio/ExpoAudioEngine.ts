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
  setAudioModeAsync,
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

  // Retained audio source input for player recreation upon startup abort
  private currentSource: AudioSourceInput | null = null;

  // Startup lifecycle coordination state
  private isAwaitingNativeStart = false;
  private currentPlaybackAttemptId = 0;
  private startupTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private audioModeConfigured = false;
  private static readonly NATIVE_PREPARE_TIMEOUT_MS = 3000;

  // Seek confirmation & callback isolation state (Stage A.7.2.3.10)
  private activeSeekTargetMs: number | null = null;
  private activeSeekRevision = 0;
  private seekSafetyTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private static readonly SEEK_CONFIRMATION_WINDOW_MS = 250;
  private static readonly SEEK_SAFETY_TIMEOUT_MS = 1500;

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
   * Monotonic high-water mark for estimated playback position (Stage A.7.1).
   * Prevents estimated position from jumping backwards during continuous forward playback.
   * Reset on timeline discontinuities (seek, track replacement, stop, unload).
   */
  private lastEstimatedPositionMs: number = 0;
  private monotonicRevision: number = 0;

  /**
   * Helper returning monotonic timestamp in milliseconds.
   */
  private getMonotonicTime(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private clearStartupTimeout(): void {
    if (this.startupTimeoutHandle) {
      clearTimeout(this.startupTimeoutHandle);
      this.startupTimeoutHandle = null;
    }
  }

  private armStartupTimeout(attemptId: number): void {
    this.clearStartupTimeout();
    this.startupTimeoutHandle = setTimeout(() => {
      if (this.isAwaitingNativeStart && this.currentPlaybackAttemptId === attemptId) {
        this.handleStartupTimeout();
      }
    }, 3000);
  }

  private handleStartupTimeout(): void {
    this.clearStartupTimeout();
    this.isAwaitingNativeStart = false;
    const diagnosticPlayer = this.player as any;
    const statusSnapshot = diagnosticPlayer?.currentStatus ?? null;
    if (statusSnapshot) {
      console.warn('[AudioEngine Startup Diagnostic]', {
        isLoaded: diagnosticPlayer?.isLoaded,
        isBuffering: diagnosticPlayer?.isBuffering,
        playing: diagnosticPlayer?.playing,
        playbackState: statusSnapshot.playbackState,
        error: statusSnapshot.error,
      });
    }
    this.cleanupPlayer();
    const detail = statusSnapshot?.error
      ? ` Native detail: ${statusSnapshot.error}`
      : '';
    this.handleError(`Playback startup timed out after 3000ms awaiting native confirmation.${detail}`);
  }

  private async ensureAudioModeConfigured(): Promise<void> {
    if (this.audioModeConfigured || typeof setAudioModeAsync !== 'function') {
      return;
    }
    this.audioModeConfigured = true;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'doNotMix',
        interruptionModeAndroid: 'doNotMix',
      });
    } catch (err) {
      this.audioModeConfigured = false;
      console.warn('[AudioEngine] Audio mode setup notice:', err);
    }
  }

  /**
   * Waits for an asynchronously preparing native player (isLoaded === false) to reach
   * STATE_READY or emit a preparation error before transitioning load() to paused.
   * No-ops immediately if player.isLoaded is already true (e.g. unit mocks or cached assets).
   */
  private async waitForNativePreparation(player: AudioPlayer): Promise<void> {
    if (player.isLoaded) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let sub: { remove: () => void } | null = null;

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        if (sub) {
          sub.remove();
          sub = null;
        }
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      sub = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (this.player !== player) {
          finish();
          return;
        }
        if (status.error) {
          finish(new Error(status.error));
          return;
        }
        if (status.duration && status.duration > 0) {
          this.clock.durationMs = Math.round(status.duration * 1000);
        }
        if (status.isLoaded) {
          finish();
        }
      });

      timeoutHandle = setTimeout(() => {
        // If native is still buffering or ready on live property, allow load() to finish;
        // if an error exists, surface it cleanly.
        const currentError = (player as any).currentStatus?.error;
        if (currentError) {
          finish(new Error(currentError));
        } else {
          finish();
        }
      }, ExpoAudioEngine.NATIVE_PREPARE_TIMEOUT_MS);

      // Re-check synchronously in case state transitioned before addListener attached
      if (player.isLoaded) {
        finish();
      } else if ((player as any).currentStatus?.error) {
        finish(new Error((player as any).currentStatus.error));
      }
    });
  }

  private clearSeekSafetyTimeout(): void {
    if (this.seekSafetyTimeoutHandle) {
      clearTimeout(this.seekSafetyTimeoutHandle);
      this.seekSafetyTimeoutHandle = null;
    }
  }

  private armSeekSafetyTimeout(seekRev: number): void {
    this.clearSeekSafetyTimeout();
    this.seekSafetyTimeoutHandle = setTimeout(() => {
      if (this.activeSeekTargetMs !== null && this.activeSeekRevision === seekRev) {
        this.handleSeekTimeout();
      }
    }, ExpoAudioEngine.SEEK_SAFETY_TIMEOUT_MS);
  }

  private handleSeekTimeout(): void {
    this.clearSeekSafetyTimeout();
    this.activeSeekTargetMs = null;
    this.monotonicRevision = this.clock.timelineRevision;
    this.clock.updatedAtMs = this.getMonotonicTime();
    this.lastEstimatedPositionMs = this.clock.positionMs;
    this.notifyClock();
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
   * Recreates a fresh native player instance after an unconfirmed startup cancellation.
   * Restores source, rate, and playback position before initiating playback.
   */
  private async recreatePlayer(seekPositionMs: number): Promise<void> {
    if (!this.currentSource) {
      throw new Error('No audio source available for player recreation.');
    }

    this.cleanupPlayer();
    const nativeSource = this.resolveSource(this.currentSource);
    this.player = createAudioPlayer(nativeSource, {
      updateInterval: 50,
      keepAudioSessionActive: true,
    });

    this.statusSubscription = this.player.addListener(
      'playbackStatusUpdate',
      (status: AudioStatus) => {
        this.handleNativeStatusUpdate(status);
      }
    );

    if (this.clock.rate !== 1.0) {
      this.player.playbackRate = this.clock.rate;
    }

    if (seekPositionMs > 0) {
      await this.player.seekTo(seekPositionMs / 1000);
    }
  }

  /**
   * Load an audio source (bundled asset or local URI).
   */
  public async load(source: AudioSourceInput): Promise<void> {
    try {
      this.clearStartupTimeout();
      this.clearSeekSafetyTimeout();
      this.activeSeekTargetMs = null;
      this.isAwaitingNativeStart = false;
      this.currentPlaybackAttemptId++;
      this.currentSource = source;

      this.updateStatus('loading');
      this.clock.errorMessage = null;

      // Clean up previous player instance if any
      this.cleanupPlayer();
      await this.ensureAudioModeConfigured();

      // Reset seek queue
      this.isSeekingNative = false;
      this.pendingSeekTargetSec = null;

      // Increment timeline revision for new track
      this.timelineRevision++;
      this.clock.timelineRevision = this.timelineRevision;
      this.clock.positionMs = 0;
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.lastEstimatedPositionMs = 0;
      this.monotonicRevision = this.timelineRevision;

      const nativeSource = this.resolveSource(source);

      // Create new player with 50ms update interval for tight sensory synchronization
      const createdPlayer = createAudioPlayer(nativeSource, {
        updateInterval: 50,
        keepAudioSessionActive: true,
      });
      this.player = createdPlayer;

      // Subscribe to real-time status updates from native player
      this.statusSubscription = createdPlayer.addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => {
          this.handleNativeStatusUpdate(status);
        }
      );

      // Pre-populate duration if provided in input
      if (typeof source === 'object' && source !== null && 'durationMs' in source && source.durationMs) {
        this.clock.durationMs = source.durationMs;
      }

      // Wait for native media extractor / codec readiness when preparing asynchronously
      if (createdPlayer.isLoaded === false) {
        await this.waitForNativePreparation(createdPlayer);
      }
      if (this.player !== createdPlayer) {
        return;
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
      if (this.currentSource) {
        try {
          await this.recreatePlayer(this.clock.positionMs);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.handleError(`Failed to recreate player: ${message}`);
          return;
        }
      } else {
        this.handleError('Cannot play: No audio player loaded.');
        return;
      }
    }

    try {
      this.currentPlaybackAttemptId++;
      const attemptId = this.currentPlaybackAttemptId;
      this.isAwaitingNativeStart = true;
      this.armStartupTimeout(attemptId);

      // Issue native play command; clock stays in its pre-play state (paused/stopped)
      // until native confirms active non-buffering playback.
      this.player!.play();
    } catch (err: unknown) {
      this.clearStartupTimeout();
      this.isAwaitingNativeStart = false;
      const message = err instanceof Error ? err.message : String(err);
      this.handleError(`Playback start failed: ${message}`);
    }
  }

  /**
   * Pause audio playback.
   */
  public async pause(): Promise<void> {
    this.clearStartupTimeout();
    this.clearSeekSafetyTimeout();
    this.activeSeekTargetMs = null;
    this.currentPlaybackAttemptId++;

    if (this.isAwaitingNativeStart) {
      // Startup cancellation: user paused before native playback was confirmed.
      // Dispose of the unconfirmed player and remove its subscription to prevent
      // stale delayed native events from contaminating future playback attempts.
      this.cleanupPlayer();
      this.isAwaitingNativeStart = false;
      this.updateStatus('paused');
      this.notifyClock();
      return;
    }

    if (!this.player) return;

    try {
      this.player.pause();
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.lastEstimatedPositionMs = this.clock.positionMs;
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
   * Advances timeline revision to cleanly invalidate the previous playback session,
   * clear scheduler history, and enable complete sensory cue rescheduling upon replay.
   */
  public async stop(): Promise<void> {
    this.clearStartupTimeout();
    this.clearSeekSafetyTimeout();
    this.activeSeekTargetMs = null;
    this.currentPlaybackAttemptId++;

    if (this.isAwaitingNativeStart) {
      // Startup cancellation via stop: dispose unconfirmed player
      this.cleanupPlayer();
      this.isAwaitingNativeStart = false;
      this.timelineRevision++;
      this.clock.timelineRevision = this.timelineRevision;
      this.clock.positionMs = 0;
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.lastEstimatedPositionMs = 0;
      this.monotonicRevision = this.timelineRevision;
      this.updateStatus('stopped');
      this.notifyClock();
      return;
    }

    if (!this.player) return;

    // Avoid redundant revision churn if already cleanly stopped at position 0
    if (this.clock.status === 'stopped' && this.clock.positionMs === 0) {
      return;
    }

    try {
      this.player.pause();
      await this.player.seekTo(0);
      this.clock.positionMs = 0;
      this.clock.updatedAtMs = this.getMonotonicTime();
      // Increment timeline revision on stop to invalidate previous playback session
      this.timelineRevision++;
      this.clock.timelineRevision = this.timelineRevision;
      this.lastEstimatedPositionMs = 0;
      this.monotonicRevision = this.timelineRevision;
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
    this.clearStartupTimeout();
    this.clearSeekSafetyTimeout();
    this.currentPlaybackAttemptId++;

    const clampedMs = Math.max(0, Math.min(positionMs, this.clock.durationMs || positionMs));
    const targetSeconds = clampedMs / 1000;

    // Increment timeline revision on seek to invalidate downstream cues
    this.timelineRevision++;
    this.clock.timelineRevision = this.timelineRevision;
    this.clock.positionMs = clampedMs;
    this.clock.updatedAtMs = this.getMonotonicTime();
    this.lastEstimatedPositionMs = clampedMs;

    // Suspend forward monotonic floor until native confirms the seek target
    this.monotonicRevision = 0;
    this.activeSeekTargetMs = clampedMs;
    this.activeSeekRevision = this.timelineRevision;
    this.armSeekSafetyTimeout(this.timelineRevision);

    this.notifyClock();

    if (this.isAwaitingNativeStart) {
      this.clearSeekSafetyTimeout();
      this.activeSeekTargetMs = null;
      this.cleanupPlayer();
      this.isAwaitingNativeStart = false;
      if (this.currentSource) {
        await this.recreatePlayer(clampedMs);
      }
      return;
    }

    if (!this.player) return;
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
    // While awaiting native playback start or awaiting seek confirmation, return exact position
    if (this.isAwaitingNativeStart || this.activeSeekTargetMs !== null) {
      return this.clock.positionMs;
    }

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
    const clampedProjected = Math.max(0, Math.min(Math.round(projectedMs), this.clock.durationMs));

    // Continuous forward playback monotonic guarantee (Stage A.7.1):
    // When playing forward (rate > 0) within the same timeline revision, prevent backward jumps
    // caused by delayed native status updates or buffer timing jitter.
    if (this.clock.rate > 0 && this.monotonicRevision === this.clock.timelineRevision) {
      const monotonicMs = Math.max(this.lastEstimatedPositionMs, clampedProjected);
      const boundedMs = Math.min(monotonicMs, this.clock.durationMs);
      this.lastEstimatedPositionMs = boundedMs;
      return boundedMs;
    }

    this.lastEstimatedPositionMs = clampedProjected;
    return clampedProjected;
  }

  /**
   * Unload player and release resources.
   */
  public async unload(): Promise<void> {
    this.clearStartupTimeout();
    this.clearSeekSafetyTimeout();
    this.activeSeekTargetMs = null;
    this.currentPlaybackAttemptId++;
    this.isAwaitingNativeStart = false;
    this.currentSource = null;
    this.cleanupPlayer();
    this.isSeekingNative = false;
    this.pendingSeekTargetSec = null;
    this.lastEstimatedPositionMs = 0;
    this.monotonicRevision = 0;
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
    // Strict player instance boundary: discard events from old or disposed players
    if (!this.player || (status.id && this.player.id && status.id !== this.player.id)) {
      return;
    }

    if (status.error) {
      this.handleError(status.error);
      return;
    }

    const posMs = Math.round((status.currentTime || 0) * 1000);
    const durMs = Math.round((status.duration || 0) * 1000);

    if (durMs > 0) {
      this.clock.durationMs = durMs;
    }

    // If actively awaiting native start confirmation:
    if (this.isAwaitingNativeStart) {
      if (status.playing && !status.isBuffering) {
        // Valid native playback confirmation!
        this.clearStartupTimeout();
        this.isAwaitingNativeStart = false;
        this.clock.positionMs = posMs;
        this.clock.updatedAtMs = this.getMonotonicTime();
        this.lastEstimatedPositionMs = posMs;
        this.monotonicRevision = this.clock.timelineRevision;
        this.clock.isBuffering = false;
        this.updateStatus('playing');
        this.notifyClock();
        return;
      } else if (status.isBuffering) {
        // Initial startup buffering: stay awaiting, hold clock at position
        this.clock.isBuffering = true;
        this.notifyClock();
        return;
      } else {
        // Still preparing (playing is false): stay awaiting
        return;
      }
    }

    // Seek confirmation check (Stage A.7.2.3.10):
    // Guard against delayed pre-seek native status callbacks poisoning the monotonic clock.
    if (this.activeSeekTargetMs !== null) {
      const seekDelta = Math.abs(posMs - this.activeSeekTargetMs);
      if (seekDelta > ExpoAudioEngine.SEEK_CONFIRMATION_WINDOW_MS) {
        // Discard stale pre-seek status update outside proximity window
        if (status.isBuffering !== undefined && status.isBuffering !== this.clock.isBuffering) {
          this.clock.isBuffering = status.isBuffering;
          this.notifyClock();
        }
        return;
      }

      // Native seek confirmed within confirmation window!
      this.clearSeekSafetyTimeout();
      this.activeSeekTargetMs = null;
      this.clock.positionMs = posMs;
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.lastEstimatedPositionMs = posMs;
      // Reactivate forward monotonic floor for this timeline revision
      this.monotonicRevision = this.clock.timelineRevision;
    }

    // Only update positionMs if not actively seeking natively (prevents backwards jump before seek lands)
    if (!this.isSeekingNative) {
      this.clock.positionMs = posMs;
      this.clock.updatedAtMs = this.getMonotonicTime();
    }

    const wasBuffering = this.clock.isBuffering;
    this.clock.isBuffering = status.isBuffering ?? false;
    if (wasBuffering && !this.clock.isBuffering) {
      // Buffering cleared: re-anchor clock to resume forward estimation from current native position
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.lastEstimatedPositionMs = this.clock.positionMs;
    }

    const rateChanged = status.playbackRate !== undefined && status.playbackRate !== this.clock.rate;
    if (rateChanged) {
      // Playback rate changed: re-anchor clock to extrapolate at the new rate from current native position
      this.clock.rate = status.playbackRate || 1.0;
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.lastEstimatedPositionMs = this.clock.positionMs;
    } else {
      this.clock.rate = status.playbackRate || 1.0;
    }

    if (status.didJustFinish) {
      this.clock.positionMs = this.clock.durationMs;
      this.clock.updatedAtMs = this.getMonotonicTime();
      this.lastEstimatedPositionMs = this.clock.durationMs;
      this.updateStatus('stopped');
    } else if (status.isLoaded) {
      if (status.playing) {
        if (this.clock.status !== 'playing') {
          this.clock.updatedAtMs = this.getMonotonicTime();
          this.lastEstimatedPositionMs = this.clock.positionMs;
          this.monotonicRevision = this.clock.timelineRevision;
        }
        this.updateStatus('playing');
      } else {
        // Native reports playing == false (e.g. paused by user or interrupted by audio focus loss / headphones unplugged)
        if (this.clock.status === 'playing') {
          this.clock.updatedAtMs = this.getMonotonicTime();
          this.lastEstimatedPositionMs = this.clock.positionMs;
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
    this.clearSeekSafetyTimeout();
    this.activeSeekTargetMs = null;
    if (this.statusSubscription) {
      this.statusSubscription.remove();
      this.statusSubscription = null;
    }
    if (this.player) {
      try {
        this.player.pause();
      } catch {
        // Ignore pause errors on already-stopped/unloaded players
      }
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
