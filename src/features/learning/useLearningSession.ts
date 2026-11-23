/**
 * useLearningSession
 *
 * Authoritative session store and hook for VibeBridge Tactile Drum Academy.
 * Manages active lesson, teacher demonstration recordings, user practice taps,
 * real-time tactile haptic actuation, and comparative performance evaluation.
 */

import { useState, useEffect, useCallback } from 'react';
import * as ExpoHaptics from 'expo-haptics';
import { liveConcertEngine } from '@/engines/live';
import {
  DrumHit,
  DrumPattern,
  DrumType,
  EvaluationScore,
  HitAlignment,
  InstrumentCategory,
  LearningSessionState,
  UserPracticeTap,
} from './types';
import { CANONICAL_ROCK_FOUNDATION_PATTERN } from './data/standardDrumPatterns';

// Global singleton state so navigation between screen routes retains progress
let globalSessionState: LearningSessionState = {
  selectedInstrument: 'drums',
  activePattern: CANONICAL_ROCK_FOUNDATION_PATTERN,
  teacherSource: 'canonical',
  recordedTeacherHits: CANONICAL_ROCK_FOUNDATION_PATTERN.hits,
  practiceTaps: [],
  lastEvaluation: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Trigger immediate physical haptic feedback calibrated for each drum element.
 */
export async function playDrumHaptic(drum: DrumType): Promise<void> {
  try {
    switch (drum) {
      case 'kick':
        // Kick drum: Heavy thud / low-frequency physical surge
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy);
        try {
          await liveConcertEngine.testPattern('bass_punch');
        } catch {
          // Fallback handled cleanly by ExpoHaptics
        }
        break;
      case 'snare':
        // Snare drum: Sharp, snappy mid-frequency impact
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
        try {
          await liveConcertEngine.testPattern('percussion_snap');
        } catch {
          // Fallback handled cleanly by ExpoHaptics
        }
        break;
      case 'hihat':
        // Hi-Hat: Crisp, micro-transient tick
        await ExpoHaptics.selectionAsync();
        try {
          await liveConcertEngine.testPattern('melody_tick');
        } catch {
          // Fallback handled cleanly by ExpoHaptics
        }
        break;
      case 'uncertain':
      default:
        await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
        break;
    }
  } catch {
    // Graceful silent fallback if device lacks haptic motor
  }
}

export function useLearningSession() {
  const [state, setState] = useState<LearningSessionState>(globalSessionState);

  useEffect(() => {
    const listener = () => setState({ ...globalSessionState });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setSelectedInstrument = useCallback((category: InstrumentCategory) => {
    globalSessionState.selectedInstrument = category;
    notifyListeners();
  }, []);

  const setActivePattern = useCallback((pattern: DrumPattern) => {
    globalSessionState.activePattern = pattern;
    if (globalSessionState.teacherSource === 'canonical') {
      globalSessionState.recordedTeacherHits = pattern.hits;
    }
    notifyListeners();
  }, []);

  const setTeacherSource = useCallback((source: 'canonical' | 'live_mic') => {
    globalSessionState.teacherSource = source;
    if (source === 'canonical') {
      globalSessionState.recordedTeacherHits = globalSessionState.activePattern.hits;
    }
    notifyListeners();
  }, []);

  const setRecordedTeacherHits = useCallback((hits: DrumHit[]) => {
    globalSessionState.recordedTeacherHits = hits;
    notifyListeners();
  }, []);

  const addPracticeTap = useCallback((drum: DrumType, timestampMs: number) => {
    const newTap: UserPracticeTap = {
      id: `tap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      drum,
      timestampMs,
    };
    globalSessionState.practiceTaps = [...globalSessionState.practiceTaps, newTap];
    notifyListeners();
    // Actuate immediate tactile feedback for the learner
    playDrumHaptic(drum);
    return newTap;
  }, []);

  const clearPracticeTaps = useCallback(() => {
    globalSessionState.practiceTaps = [];
    globalSessionState.lastEvaluation = null;
    notifyListeners();
  }, []);

  /**
   * Evaluates the learner's practice taps against the reference track.
   */
  const evaluateSession = useCallback((): EvaluationScore => {
    const referenceHits =
      globalSessionState.recordedTeacherHits.length > 0
        ? globalSessionState.recordedTeacherHits
        : globalSessionState.activePattern.hits;

    const userTaps = [...globalSessionState.practiceTaps];

    // If no reference hits, return empty baseline
    if (referenceHits.length === 0) {
      const emptyScore: EvaluationScore = {
        overallAccuracy: 0,
        timingScore: 0,
        rhythmConsistency: 0,
        hitCountScore: 0,
        averageOffsetMs: 0,
        matchedHitsCount: 0,
        totalReferenceHits: 0,
        userTapsCount: userTaps.length,
        feedbackBadge: 'No Pattern Loaded',
        feedbackDetails: 'Please record or select a reference rhythm pattern first.',
        hitAlignments: [],
      };
      globalSessionState.lastEvaluation = emptyScore;
      notifyListeners();
      return emptyScore;
    }

    // Evaluate primary percussion (Kicks and Snares, plus Hi-Hats if user tapped any)
    const hasUserHiHats = userTaps.some((t) => t.drum === 'hihat');
    const targetHits = hasUserHiHats
      ? referenceHits
      : referenceHits.filter((h) => h.drum === 'kick' || h.drum === 'snare');

    const availableTaps = [...userTaps];
    const alignments: HitAlignment[] = [];
    const deltas: number[] = [];
    let matchedCount = 0;

    // Temporal matching window: ±250ms
    const MATCH_WINDOW_MS = 250;

    targetHits.forEach((target) => {
      // Find matching tap of same drum type within window
      let closestIdx = -1;
      let minDistance = Infinity;

      availableTaps.forEach((tap, idx) => {
        if (tap.drum === target.drum) {
          const distance = Math.abs(tap.timestampMs - target.timestampMs);
          if (distance <= MATCH_WINDOW_MS && distance < minDistance) {
            minDistance = distance;
            closestIdx = idx;
          }
        }
      });

      if (closestIdx !== -1) {
        const matchedTap = availableTaps[closestIdx];
        const delta = matchedTap.timestampMs - target.timestampMs;
        deltas.push(Math.abs(delta));
        matchedCount++;

        let status: 'on_time' | 'early' | 'late' = 'on_time';
        if (delta < -60) {
          status = 'early';
        } else if (delta > 60) {
          status = 'late';
        }

        alignments.push({
          targetHit: target,
          userTap: matchedTap,
          status,
          deltaMs: delta,
        });

        // Mark tap as used
        availableTaps.splice(closestIdx, 1);
      } else {
        alignments.push({
          targetHit: target,
          userTap: undefined,
          status: 'missed',
        });
      }
    });

    // Compute metrics
    const avgOffset =
      deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 120;

    // Timing score: 100 at 0ms error, 0 at >=180ms error
    const timingScore = Math.max(0, Math.min(100, Math.round(100 - (avgOffset / 180) * 100)));

    // Hit count score: percentage of target hits matched
    const hitCountScore = Math.max(
      0,
      Math.min(100, Math.round((matchedCount / targetHits.length) * 100))
    );

    // Rhythm consistency: variance in offsets
    let consistency = 85;
    if (deltas.length > 1) {
      const variance =
        deltas.reduce((sum, d) => sum + Math.pow(d - avgOffset, 2), 0) / deltas.length;
      const stdDev = Math.sqrt(variance);
      consistency = Math.max(0, Math.min(100, Math.round(100 - (stdDev / 80) * 100)));
    }

    // Overall weighted accuracy
    const overallAccuracy = Math.round(
      timingScore * 0.45 + hitCountScore * 0.45 + consistency * 0.1
    );

    let feedbackBadge = 'Keep Practicing! 🎯';
    let feedbackDetails =
      'Focus on feeling the heavy kick downbeat on 1 & 3 before speeding up.';

    if (overallAccuracy >= 90) {
      feedbackBadge = 'Groove Master! 🥁';
      feedbackDetails =
        'Exceptional tactile timing! Your kick and snare transients lock directly into the pocket.';
    } else if (overallAccuracy >= 75) {
      feedbackBadge = 'Solid Rhythm! 👍';
      feedbackDetails =
        'Very strong groove feel. A few snare backbeats were slightly early, but your pulse is locked.';
    } else if (overallAccuracy >= 55) {
      feedbackBadge = 'Building Muscle Memory! 💡';
      feedbackDetails =
        'Good start! Try using the "Feel & Memorize" mode to absorb the tactile pulse before tapping.';
    }

    const evaluation: EvaluationScore = {
      overallAccuracy,
      timingScore,
      rhythmConsistency: consistency,
      hitCountScore,
      averageOffsetMs: Math.round(avgOffset * 10) / 10,
      matchedHitsCount: matchedCount,
      totalReferenceHits: targetHits.length,
      userTapsCount: userTaps.length,
      feedbackBadge,
      feedbackDetails,
      hitAlignments: alignments,
    };

    globalSessionState.lastEvaluation = evaluation;
    notifyListeners();
    return evaluation;
  }, []);

  const resetSession = useCallback(() => {
    globalSessionState = {
      selectedInstrument: 'drums',
      activePattern: CANONICAL_ROCK_FOUNDATION_PATTERN,
      teacherSource: 'canonical',
      recordedTeacherHits: CANONICAL_ROCK_FOUNDATION_PATTERN.hits,
      practiceTaps: [],
      lastEvaluation: null,
    };
    notifyListeners();
  }, []);

  return {
    selectedInstrument: state.selectedInstrument,
    activePattern: state.activePattern,
    teacherSource: state.teacherSource,
    recordedTeacherHits: state.recordedTeacherHits,
    practiceTaps: state.practiceTaps,
    lastEvaluation: state.lastEvaluation,
    setSelectedInstrument,
    setActivePattern,
    setTeacherSource,
    setRecordedTeacherHits,
    addPracticeTap,
    clearPracticeTaps,
    evaluateSession,
    resetSession,
    playDrumHaptic,
  };
}
