/**
 * Synchronization Engine & Master Clock Types
 */

import { PlaybackClock, PlaybackStatus } from '@/types';

export type SensoryChannel = 'audio' | 'haptic' | 'visual' | 'lyrics';

/**
 * Latency Offsets in milliseconds.
 *
 * Sign Convention:
 * A positive offset (+L) indicates that the physical output pipeline introduces
 * an L millisecond delay between electrical trigger and physical user perception.
 *
 * To align all sensory channels to perceived audio:
 *   leadTime = channelOffsetMs - audioOffsetMs
 *   triggerTimestampMs = targetTimestampMs - leadTime
 */
export interface LatencyOffsets {
  /** Bluetooth or external audio buffering delay (ms). Default: 0 */
  audioOffsetMs: number;
  /** Physical motor spin-up / acceleration delay (ms). Default: 25 */
  hapticOffsetMs: number;
  /** Display frame composition / rasterization delay (ms). Default: 16 */
  visualOffsetMs: number;
  /** Anticipatory text reading offset (ms). Default: 0 */
  lyricsOffsetMs: number;
}

/**
 * Clean Master Clock Abstraction
 * Distributes authoritative timing information to all sensory consumers.
 */
export interface MasterClock {
  /**
   * Continuous timeline estimation using monotonic anchoring and playback rate.
   * Never advances while paused, stopped, buffering, or idle.
   */
  getEstimatedPositionMs(atTimeMs?: number): number;

  /**
   * Returns current authoritative PlaybackClock snapshot.
   */
  getClock(): PlaybackClock;

  /**
   * Subscribe to authoritative clock updates.
   */
  onClockUpdate(callback: (clock: PlaybackClock) => void): () => void;

  /**
   * Subscribe to discrete playback status changes.
   */
  onStatusChange(callback: (status: PlaybackStatus) => void): () => void;
}

/**
 * Raw scheduled event input submitted by feature modules.
 */
export interface ScheduledEventInput<T = unknown> {
  id: string;
  targetTimestampMs: number;
  type: string;
  channel: SensoryChannel;
  payload: T;
  /** Optional: target timeline revision. If omitted, assigned by scheduler. */
  timelineRevision?: number;
}

/**
 * Fully resolved and dispatched event delivered to subscribers.
 */
export interface DispatchedEvent<T = unknown> {
  id: string;
  targetTimestampMs: number;
  scheduledTimestampMs: number;
  dispatchedAtMs: number;
  timelineRevision: number;
  type: string;
  channel: SensoryChannel;
  payload: T;
}

export type EventSubscriber<T = unknown> = (event: DispatchedEvent<T>) => void;
