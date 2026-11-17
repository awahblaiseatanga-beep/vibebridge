/**
 * Demo Track Lyrics (READ Pillar)
 *
 * Original demonstration lyrics composed specifically for the bundled 120 BPM
 * demonstration stem: assets/music/vibebridge_demo.wav (12.0 seconds, 6 bars of 4/4).
 *
 * ACCESSIBILITY & TRANSPARENCY NOTICE:
 * The bundled audio file is an instrumental/synthesized rhythm stem.
 * These original demonstration lyrics illustrate how real-time synchronized text
 * integrates with tactile haptics (FEEL) and visual rhythm (SEE).
 *
 * Label: "Demo Lyrics · Synchronized to 120 BPM Stem"
 */

import { TrackLyrics } from '@/engines/lyrics';

export const DEMO_TRACK_ID = 'demo-track-120bpm';

export const DEMO_TRACK_LYRICS: TrackLyrics = {
  trackId: DEMO_TRACK_ID,
  title: 'VibeBridge 120 BPM Showcase',
  artist: 'Accessibility Rhythm Stem',
  durationMs: 12000,
  isDemonstration: true,
  demonstrationLabel: 'Demo Lyrics · Synchronized to 120 BPM Stem',
  segments: [
    {
      id: 'demo-line-1',
      trackId: DEMO_TRACK_ID,
      startMs: 500,
      endMs: 3500,
      text: 'Feel the pulse begin, deep in your hands',
      speaker: 'Verse',
    },
    {
      id: 'demo-line-2',
      trackId: DEMO_TRACK_ID,
      startMs: 4000,
      endMs: 6500,
      text: 'See the colors rise, dancing with the beat',
      speaker: 'Verse',
    },
    {
      id: 'demo-line-3',
      trackId: DEMO_TRACK_ID,
      startMs: 7500,
      endMs: 9500,
      text: 'Sound and motion moving as one',
      speaker: 'Climax',
    },
    {
      id: 'demo-line-4',
      trackId: DEMO_TRACK_ID,
      startMs: 10000,
      endMs: 11500,
      text: 'Every rhythm shared in harmony',
      speaker: 'Resolution',
    },
  ],
};
