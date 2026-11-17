/**
 * LyricsTimeline
 *
 * Deterministic timeline manager and fast active-segment resolver.
 * Evaluates the authoritative active lyric line, previous line, upcoming lines,
 * and explicit instrumental gap / transition states.
 */

import { ScheduledEventInput } from '@/engines/synchronization';
import {
  LyricActiveStatus,
  LyricCuePayload,
  LyricSegment,
  TrackLyrics,
} from './types';
import { LyricsValidator } from './LyricsValidator';

export interface TimelineResolution {
  status: LyricActiveStatus;
  activeIndex: number;
  activeSegment: LyricSegment | null;
  previousSegment: LyricSegment | null;
  upcomingSegments: LyricSegment[];
}

export class LyricsTimeline {
  private readonly segments: LyricSegment[];
  private readonly trackId: string | null;
  private readonly durationMs: number;
  private readonly isDemonstration: boolean;
  private readonly demonstrationLabel?: string;

  constructor(lyrics: TrackLyrics | null) {
    if (lyrics) {
      LyricsValidator.validate(lyrics);
      this.segments = [...lyrics.segments];
      this.trackId = lyrics.trackId;
      this.durationMs = lyrics.durationMs;
      this.isDemonstration = !!lyrics.isDemonstration;
      this.demonstrationLabel = lyrics.demonstrationLabel;
    } else {
      this.segments = [];
      this.trackId = null;
      this.durationMs = 0;
      this.isDemonstration = false;
      this.demonstrationLabel = undefined;
    }
  }

  public getTrackId(): string | null {
    return this.trackId;
  }

  public getDurationMs(): number {
    return this.durationMs;
  }

  public getSegments(): LyricSegment[] {
    return [...this.segments];
  }

  public getSegmentCount(): number {
    return this.segments.length;
  }

  public hasLyrics(): boolean {
    return this.segments.length > 0;
  }

  public getIsDemonstration(): boolean {
    return this.isDemonstration;
  }

  public getDemonstrationLabel(): string | undefined {
    return this.demonstrationLabel;
  }

  /**
   * Resolves the active segment and context at any given position in milliseconds.
   * Utilizes binary search for O(log n) lookup efficiency.
   * Handles segment gaps, pre-track, and post-track states explicitly.
   */
  public resolveAt(positionMs: number): TimelineResolution {
    const total = this.segments.length;

    // 1. No lyrics loaded
    if (total === 0) {
      return {
        status: 'no_lyrics',
        activeIndex: -1,
        activeSegment: null,
        previousSegment: null,
        upcomingSegments: [],
      };
    }

    const clampedPos = Math.max(0, positionMs);

    // 2. Position is prior to the first segment
    if (clampedPos < this.segments[0].startMs) {
      return {
        status: 'before_lyrics',
        activeIndex: -1,
        activeSegment: null,
        previousSegment: null,
        upcomingSegments: this.segments.slice(0, 3),
      };
    }

    // 3. Position is past the final segment's end
    if (clampedPos >= this.segments[total - 1].endMs) {
      return {
        status: 'after_lyrics',
        activeIndex: -1,
        activeSegment: null,
        previousSegment: this.segments[total - 1],
        upcomingSegments: [],
      };
    }

    // 4. Binary search for active segment or intermediate gap
    let low = 0;
    let high = total - 1;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      const seg = this.segments[mid];

      if (clampedPos >= seg.startMs && clampedPos < seg.endMs) {
        // Active segment match
        return {
          status: 'active',
          activeIndex: mid,
          activeSegment: seg,
          previousSegment: mid > 0 ? this.segments[mid - 1] : null,
          upcomingSegments: this.segments.slice(mid + 1, mid + 4),
        };
      }

      if (clampedPos < seg.startMs) {
        // Check if position is in the instrumental gap between segment[mid - 1] and segment[mid]
        if (mid > 0 && clampedPos >= this.segments[mid - 1].endMs) {
          return {
            status: 'instrumental_gap',
            activeIndex: -1,
            activeSegment: null,
            previousSegment: this.segments[mid - 1],
            upcomingSegments: this.segments.slice(mid, mid + 3),
          };
        }
        high = mid - 1;
      } else {
        // clampedPos >= seg.endMs
        // Check if position is in the instrumental gap between segment[mid] and segment[mid + 1]
        if (mid < total - 1 && clampedPos < this.segments[mid + 1].startMs) {
          return {
            status: 'instrumental_gap',
            activeIndex: -1,
            activeSegment: null,
            previousSegment: seg,
            upcomingSegments: this.segments.slice(mid + 1, mid + 4),
          };
        }
        low = mid + 1;
      }
    }

    // Fallback gap resolution (safety branch)
    return {
      status: 'instrumental_gap',
      activeIndex: -1,
      activeSegment: null,
      previousSegment: null,
      upcomingSegments: this.segments.slice(0, 3),
    };
  }

  /**
   * Converts the timeline into discrete 'enter' and 'exit' boundary events
   * suitable for scheduling onto PriorityEventScheduler's 'lyrics' channel.
   */
  public toScheduledEvents(timelineRevision?: number): ScheduledEventInput<LyricCuePayload>[] {
    const events: ScheduledEventInput<LyricCuePayload>[] = [];

    for (const seg of this.segments) {
      // Line Entry Event
      events.push({
        id: `lyric-enter-${seg.id}`,
        targetTimestampMs: seg.startMs,
        channel: 'lyrics',
        type: 'lyric_boundary',
        timelineRevision,
        payload: {
          segmentId: seg.id,
          action: 'enter',
          startMs: seg.startMs,
          endMs: seg.endMs,
          text: seg.text,
          speaker: seg.speaker,
        },
      });

      // Line Exit Event (marks transition into gap or next line)
      events.push({
        id: `lyric-exit-${seg.id}`,
        targetTimestampMs: seg.endMs,
        channel: 'lyrics',
        type: 'lyric_boundary',
        timelineRevision,
        payload: {
          segmentId: seg.id,
          action: 'exit',
          startMs: seg.startMs,
          endMs: seg.endMs,
          text: seg.text,
          speaker: seg.speaker,
        },
      });
    }

    return events;
  }
}
