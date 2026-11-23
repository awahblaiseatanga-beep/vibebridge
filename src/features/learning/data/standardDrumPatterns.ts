/**
 * Standard Drum Patterns & Lessons for VibeBridge Academy
 *
 * Provides the canonical reference curriculum for Deaf & hard-of-hearing learners.
 * The primary active pattern is the 4-measure Rock Foundation Groove at 120 BPM.
 */

import { DrumHit, DrumPattern } from '../types';

function generateStandardRockGrooveHits(): DrumHit[] {
  const hits: DrumHit[] = [];
  const bpm = 120;
  const beatMs = 60000 / bpm; // 500ms
  const barMs = beatMs * 4;   // 2000ms

  for (let bar = 1; bar <= 4; bar++) {
    const barOffset = (bar - 1) * barMs;

    // Hi-Hat on every eighth-note (8 pulses per bar)
    for (let eighth = 0; eighth < 8; eighth++) {
      const beatNum = 1 + eighth * 0.5;
      const timeMs = barOffset + eighth * (beatMs / 2);
      hits.push({
        id: `b${bar}-hh-${eighth + 1}`,
        drum: 'hihat',
        timestampMs: timeMs,
        bar,
        beat: beatNum,
        intensity: eighth % 2 === 0 ? 'medium' : 'soft',
        label: `Hi-Hat (Bar ${bar}, Beat ${beatNum})`,
        confidence: 1.0,
      });
    }

    // Kick on Beats 1 and 3 (Downbeats)
    hits.push({
      id: `b${bar}-kick-1`,
      drum: 'kick',
      timestampMs: barOffset + 0,
      bar,
      beat: 1.0,
      intensity: 'strong',
      label: `Kick (Bar ${bar}, Beat 1)`,
      confidence: 1.0,
    });
    hits.push({
      id: `b${bar}-kick-3`,
      drum: 'kick',
      timestampMs: barOffset + beatMs * 2,
      bar,
      beat: 3.0,
      intensity: 'strong',
      label: `Kick (Bar ${bar}, Beat 3)`,
      confidence: 1.0,
    });

    // Snare on Beats 2 and 4 (Backbeats)
    hits.push({
      id: `b${bar}-snare-2`,
      drum: 'snare',
      timestampMs: barOffset + beatMs,
      bar,
      beat: 2.0,
      intensity: 'strong',
      label: `Snare (Bar ${bar}, Beat 2)`,
      confidence: 1.0,
    });
    hits.push({
      id: `b${bar}-snare-4`,
      drum: 'snare',
      timestampMs: barOffset + beatMs * 3,
      bar,
      beat: 4.0,
      intensity: 'strong',
      label: `Snare (Bar ${bar}, Beat 4)`,
      confidence: 1.0,
    });
  }

  // Sort chronologically
  return hits.sort((a, b) => a.timestampMs - b.timestampMs);
}

export const CANONICAL_ROCK_FOUNDATION_PATTERN: DrumPattern = {
  id: 'lesson-drums-rock-44',
  title: 'Rock 4/4 Foundation Groove',
  subtitle: 'Kick, Snare & Steady Eighth-Note Hi-Hat',
  instrument: 'drums',
  bpm: 120,
  bars: 4,
  beatsPerBar: 4,
  totalDurationMs: 8000, // 4 bars * 2000ms
  hits: generateStandardRockGrooveHits(),
  description:
    'The foundational beat of modern music. Kick pulses on 1 and 3, Snare cracks on 2 and 4, accompanied by steady hi-hat eighth notes.',
  difficulty: 'Beginner',
  tactileDescription:
    'Heavy bass thud in palm on beats 1 & 3; sharp mid-frequency snap on 2 & 4; light ticking throughout.',
  status: 'ready',
};

export const FUNK_SYNCOPATION_PATTERN: DrumPattern = {
  id: 'lesson-drums-funk-syncopation',
  title: 'Funk Syncopation 101',
  subtitle: 'Off-Beat Ghost Snares & Displaced Kicks',
  instrument: 'drums',
  bpm: 104,
  bars: 4,
  beatsPerBar: 4,
  totalDurationMs: 9230,
  hits: [],
  description:
    'Groove-heavy syncopated rhythms with displaced kick drum hits and ghost snares on the 16th-note grid.',
  difficulty: 'Intermediate',
  tactileDescription:
    'Complex alternating micro-pulses with syncopated accents challenging tactile rhythm reflexes.',
  status: 'coming_soon',
};

export const EIGHTH_NOTE_HIHAT_PATTERN: DrumPattern = {
  id: 'lesson-drums-eighth-hihat',
  title: 'Eighth-Note Hi-Hat Mastery',
  subtitle: 'Consistent Subdivision Timing',
  instrument: 'drums',
  bpm: 110,
  bars: 4,
  beatsPerBar: 4,
  totalDurationMs: 8727,
  hits: [],
  description:
    'Focus purely on developing steady, unwavering right-hand subdivision timing on the hi-hat pedal and cymbal.',
  difficulty: 'Beginner',
  tactileDescription:
    'Uninterrupted rapid micro-ticks that train tactile timing anticipation.',
  status: 'coming_soon',
};

export const AVAILABLE_LESSONS: DrumPattern[] = [
  CANONICAL_ROCK_FOUNDATION_PATTERN,
  FUNK_SYNCOPATION_PATTERN,
  EIGHTH_NOTE_HIHAT_PATTERN,
];
