/**
 * VibeBridge Tactile Music-Learning Experience — Types & Contracts
 * Phase 2A: Drum Learning & Haptic Rhythm Training
 *
 * Designed for Deaf and hard-of-hearing musicians to learn, memorize,
 * and reproduce rhythmic instrument patterns through synchronized
 * tactile feedback and high-contrast visual timelines.
 */

export type DrumType = 'kick' | 'snare' | 'hihat' | 'uncertain';

export type InstrumentCategory = 'drums' | 'bass' | 'piano';

export interface DrumHit {
  id: string;
  drum: DrumType;
  timestampMs: number;
  bar: number;      // 1..4 (or 1..6)
  beat: number;     // 1.0, 1.5, 2.0, etc.
  intensity: 'strong' | 'medium' | 'soft';
  confidence?: number;
  label?: string;
}

export interface UserPracticeTap {
  id: string;
  drum: DrumType;
  timestampMs: number;
  matchedHitId?: string;
  offsetMs?: number; // Delta to reference hit (positive = late, negative = early)
  accuracy?: 'perfect' | 'good' | 'early' | 'late' | 'extra';
}

export interface DrumPattern {
  id: string;
  title: string;
  subtitle: string;
  instrument: InstrumentCategory;
  bpm: number;
  bars: number;
  beatsPerBar: number;
  totalDurationMs: number;
  hits: DrumHit[];
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  tactileDescription: string;
  status: 'ready' | 'coming_soon';
}

export interface HitAlignment {
  targetHit: DrumHit;
  userTap?: UserPracticeTap;
  status: 'on_time' | 'early' | 'late' | 'missed';
  deltaMs?: number;
}

export interface EvaluationScore {
  overallAccuracy: number;     // 0..100
  timingScore: number;         // 0..100
  rhythmConsistency: number;   // 0..100
  hitCountScore: number;       // 0..100
  averageOffsetMs: number;     // e.g. 18.5 ms
  matchedHitsCount: number;
  totalReferenceHits: number;
  userTapsCount: number;
  feedbackBadge: string;       // "Groove Master! 🥁", "Solid Rhythm! 👍", etc.
  feedbackDetails: string;
  hitAlignments: HitAlignment[];
}

export interface LearningSessionState {
  selectedInstrument: InstrumentCategory;
  activePattern: DrumPattern;
  teacherSource: 'canonical' | 'live_mic';
  recordedTeacherHits: DrumHit[];
  practiceTaps: UserPracticeTap[];
  lastEvaluation: EvaluationScore | null;
}
