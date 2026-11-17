/**
 * Synchronized Lyrics Engine Types & Contracts (READ Pillar)
 *
 * Defines contracts, models, state machine, and validator structures for
 * synchronizing text lyrics with the authoritative master audio clock.
 */

import { MasterClock } from '@/engines/synchronization';
import { IEventScheduler } from '@/engines/event-scheduler';

/**
 * A single timestamped lyric segment (line).
 */
export interface LyricSegment {
  /** Unique, stable identifier for this segment */
  id: string;
  /** Track ID this lyric belongs to */
  trackId: string;
  /** Start time in milliseconds (inclusive, non-negative) */
  startMs: number;
  /** End time in milliseconds (exclusive, must be > startMs) */
  endMs: number;
  /** Plain text content of the lyric line */
  text: string;
  /** Optional speaker or structural label (e.g. 'Lead', 'Verse 1', 'Chorus') */
  speaker?: string;
  /** Optional translated or phonetically accessible text */
  translation?: string;
}

/**
 * Complete lyrics container for an audio track.
 */
export interface TrackLyrics {
  /** Identifier of the associated audio track */
  trackId: string;
  /** Optional track title */
  title?: string;
  /** Optional track artist */
  artist?: string;
  /** Total duration of the track in milliseconds */
  durationMs: number;
  /** Ordered list of lyric segments */
  segments: LyricSegment[];
  /** Flag designating demonstration/mock lyrics (e.g. for instrumental stems) */
  isDemonstration?: boolean;
  /** User-facing disclosure label for demonstration lyrics */
  demonstrationLabel?: string;
}

/**
 * Explicit status of the lyrics timeline relative to current playback position.
 */
export type LyricActiveStatus =
  | 'no_lyrics'         // Track has no associated lyrics metadata
  | 'before_lyrics'     // Playback is prior to the first lyric segment
  | 'active'            // Playback is currently within an active lyric segment
  | 'instrumental_gap'  // Playback is within an instrumental pause between segments
  | 'after_lyrics';     // Playback has progressed beyond the final lyric segment

/**
 * Reactive state snapshot exposed by the LyricsEngine to consumers and UI.
 */
export interface LyricsEngineState {
  /** Current track identifier or null if no track loaded */
  trackId: string | null;
  /** Whether lyrics metadata is available for the current track */
  hasLyrics: boolean;
  /** Whether the current lyrics are an original demonstrative track */
  isDemonstration: boolean;
  /** Explicit disclosure label if demonstration lyrics are loaded */
  demonstrationLabel?: string;
  /** Complete list of validated segments */
  segments: LyricSegment[];
  /** Explicit timeline position status */
  status: LyricActiveStatus;
  /** Index of currently active segment, or -1 if none is active */
  activeIndex: number;
  /** The currently active lyric segment, or null if in a gap/before/after */
  activeSegment: LyricSegment | null;
  /** The most recent previous lyric segment, or null if none prior */
  previousSegment: LyricSegment | null;
  /** Upcoming lyric segments following the active segment or current gap */
  upcomingSegments: LyricSegment[];
  /** Current playback position in milliseconds */
  currentPositionMs: number;
  /** Whether playback is currently paused */
  isPaused: boolean;
  /** Whether playback is currently buffering */
  isBuffering: boolean;
  /** Whether playback has completed */
  isEnded: boolean;
  /** Total count of lyric segments in this track */
  totalSegmentsCount: number;
}

/**
 * Payload dispatched via PriorityEventScheduler on the 'lyrics' channel.
 */
export interface LyricCuePayload {
  segmentId: string;
  action: 'enter' | 'exit';
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
}

/**
 * Listener callback for lyrics engine state changes.
 */
export type LyricsStateListener = (state: LyricsEngineState) => void;

/**
 * Core interface for the READ pillar lyrics engine.
 */
export interface ILyricsEngine {
  /**
   * Load and validate lyrics for a track. Passing null resets to empty state.
   */
  loadLyrics(lyrics: TrackLyrics | null): void;

  /**
   * Clear all active lyrics and reset state.
   */
  clearLyrics(): void;

  /**
   * Return the current lyrics engine state snapshot.
   */
  getState(): LyricsEngineState;

  /**
   * Query the active segment at an explicit position or current clock estimation.
   */
  getActiveSegment(positionMs?: number): LyricSegment | null;

  /**
   * Subscribe to reactive lyrics state changes.
   */
  onLyricsStateChange(listener: LyricsStateListener): () => void;

  /**
   * Attach to a MasterClock instance for continuous timeline anchoring.
   */
  attachMasterClock(clock: MasterClock): void;

  /**
   * Detach from current MasterClock instance.
   */
  detachMasterClock(): void;

  /**
   * Attach to PriorityEventScheduler for boundary cue scheduling.
   */
  attachScheduler(scheduler: IEventScheduler): void;

  /**
   * Detach from PriorityEventScheduler.
   */
  detachScheduler(): void;

  /**
   * Reset internal state.
   */
  reset(): void;

  /**
   * Release all listeners, subscriptions, and state.
   */
  dispose(): void;
}
