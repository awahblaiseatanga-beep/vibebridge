/**
 * useLyrics React Hook (READ Pillar)
 *
 * Connects React UI components to the singleton LyricsEngine instance.
 * Provides reactive access to active, previous, and upcoming lyric lines,
 * instrumental transition status, and demonstration labels.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  lyricsEngine,
  LyricsEngineState,
  TrackLyrics,
} from '@/engines/lyrics';

export function useLyrics() {
  const [state, setState] = useState<LyricsEngineState>(() => lyricsEngine.getState());

  useEffect(() => {
    // Subscribe to real-time engine state updates
    const unsubscribe = lyricsEngine.onLyricsStateChange((nextState) => {
      setState(nextState);
    });

    return unsubscribe;
  }, []);

  const loadLyrics = useCallback((lyrics: TrackLyrics | null) => {
    lyricsEngine.loadLyrics(lyrics);
  }, []);

  const clearLyrics = useCallback(() => {
    lyricsEngine.clearLyrics();
  }, []);

  return {
    state,
    hasLyrics: state.hasLyrics,
    isDemonstration: state.isDemonstration,
    demonstrationLabel: state.demonstrationLabel,
    status: state.status,
    activeSegment: state.activeSegment,
    previousSegment: state.previousSegment,
    upcomingSegments: state.upcomingSegments,
    segments: state.segments,
    activeIndex: state.activeIndex,
    totalSegmentsCount: state.totalSegmentsCount,
    loadLyrics,
    clearLyrics,
  };
}
