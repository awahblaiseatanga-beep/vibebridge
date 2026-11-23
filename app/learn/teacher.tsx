/**
 * Screen 3: Teacher Demonstration & Live Recording
 * Route: /learn/teacher
 *
 * Captures live teacher drum demonstrations via LiveConcertAudioEngine or
 * loads the canonical 4/4 Rock Foundation reference track.
 * Reuses useLiveConcert() for real-time acoustic signal capture and transient detection.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';
import { Card } from '@/components/common';
import { useLiveConcert } from '@/features/concert';
import {
  LearningHeader,
  PatternTimelineView,
  useLearningSession,
  CANONICAL_ROCK_FOUNDATION_PATTERN,
  DrumHit,
  DrumType,
} from '@/features/learning';

export default function TeacherDemonstrationScreen() {
  const router = useRouter();
  const {
    activePattern,
    teacherSource,
    recordedTeacherHits,
    setTeacherSource,
    setRecordedTeacherHits,
  } = useLearningSession();

  const [inputMode, setInputMode] = useState<'canonical' | 'live_mic'>(
    teacherSource
  );
  const [capturedHits, setCapturedHits] = useState<DrumHit[]>(
    recordedTeacherHits.length > 0
      ? recordedTeacherHits
      : CANONICAL_ROCK_FOUNDATION_PATTERN.hits
  );
  const [isRecordingLive, setIsRecordingLive] = useState(false);
  const [recordDurationMs, setRecordDurationMs] = useState(0);

  const recordingStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live microphone capture integration via useLiveConcert()
  const {
    isCapturing,
    isStarting,
    features,
    lastHapticEvent,
    startListening,
    stopListening,
    errorMessage,
  } = useLiveConcert();

  // Listen to live acoustic transients and map to captured hits
  useEffect(() => {
    if (!isRecordingLive || !features) return;

    if (features.isTransient) {
      const elapsed = Date.now() - recordingStartRef.current;
      if (elapsed > 8000) return; // Cap at 4 measures (8000ms)

      let drum: DrumType = 'snare';
      let intensity: 'strong' | 'medium' | 'soft' = 'medium';

      if (features.lowEnergy > features.midEnergy && features.lowEnergy > 0.4) {
        drum = 'kick';
        intensity = 'strong';
      } else if (features.highEnergy > 0.5) {
        drum = 'hihat';
        intensity = 'soft';
      }

      const bar = Math.min(4, Math.floor(elapsed / 2000) + 1);
      const beat = ((elapsed % 2000) / 500) + 1;

      const newHit: DrumHit = {
        id: `live-hit-${Date.now()}`,
        drum,
        timestampMs: elapsed,
        bar,
        beat: Math.round(beat * 2) / 2,
        intensity,
        confidence: Math.min(1.0, features.peak),
        label: `Teacher ${drum.toUpperCase()}`,
      };

      setCapturedHits((prev) => {
        // Debounce hits within 100ms
        const last = prev[prev.length - 1];
        if (last && Math.abs(last.timestampMs - elapsed) < 100) {
          return prev;
        }
        return [...prev, newHit];
      });
    }
  }, [features, isRecordingLive]);

  const handleStartLiveRecord = async () => {
    setCapturedHits([]);
    setIsRecordingLive(true);
    setRecordDurationMs(0);
    recordingStartRef.current = Date.now();

    await startListening();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - recordingStartRef.current;
      setRecordDurationMs(elapsed);
      if (elapsed >= 8000) {
        handleStopLiveRecord();
      }
    }, 100);
  };

  const handleStopLiveRecord = async () => {
    setIsRecordingLive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await stopListening();
  };

  const handleSelectCanonical = () => {
    setInputMode('canonical');
    setTeacherSource('canonical');
    setCapturedHits(CANONICAL_ROCK_FOUNDATION_PATTERN.hits);
  };

  const handleSelectLive = () => {
    setInputMode('live_mic');
    setTeacherSource('live_mic');
  };

  const handleSaveAndProceed = () => {
    const hitsToSave =
      inputMode === 'canonical'
        ? CANONICAL_ROCK_FOUNDATION_PATTERN.hits
        : capturedHits.length > 0
        ? capturedHits
        : CANONICAL_ROCK_FOUNDATION_PATTERN.hits;

    setRecordedTeacherHits(hitsToSave);
    setTeacherSource(inputMode);
    router.push('/learn/practice');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LearningHeader
          title="Teacher Demonstration"
          subtitle="Listen to teacher rhythm or load reference track"
          step={2}
          totalSteps={4}
          showBack={true}
        />

        {/* Source Mode Selector */}
        <View style={styles.sourceSelectorRow}>
          <TouchableOpacity
            style={[
              styles.sourceTab,
              inputMode === 'canonical' && styles.sourceTabActive,
            ]}
            onPress={handleSelectCanonical}
            accessibilityRole="tab"
          >
            <Text
              style={[
                styles.sourceTabText,
                inputMode === 'canonical' && styles.sourceTabTextActive,
              ]}
            >
              🎵 Canonical 4/4 Track
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sourceTab,
              inputMode === 'live_mic' && styles.sourceTabActive,
            ]}
            onPress={handleSelectLive}
            accessibilityRole="tab"
          >
            <Text
              style={[
                styles.sourceTabText,
                inputMode === 'live_mic' && styles.sourceTabTextActive,
              ]}
            >
              🎤 Live Mic Record
            </Text>
          </TouchableOpacity>
        </View>

        {/* Canonical Reference Overview */}
        {inputMode === 'canonical' ? (
          <Card style={styles.contentCard} variant="elevated">
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>
                  {activePattern.title} (Canonical Demo)
                </Text>
                <Text style={styles.cardSubtitle}>
                  120 BPM • 4 Bars (8.0s) • 24 Standard Rhythm Cues
                </Text>
              </View>
              <View style={styles.readyBadge}>
                <Text style={styles.readyBadgeText}>LOADED</Text>
              </View>
            </View>

            <Text style={styles.cardDescription}>
              Pre-calibrated 4-measure rock foundation with kick drum downbeats
              on beats 1 & 3, snare backbeats on 2 & 4, and continuous eighth-note
              hi-hat pulses. Ready for immediate tactile memorization.
            </Text>

            {/* Visual Timeline Ribbon */}
            <View style={styles.timelineSection}>
              <Text style={styles.sectionHeading}>Reference Drum Timeline</Text>
              <PatternTimelineView
                hits={CANONICAL_ROCK_FOUNDATION_PATTERN.hits}
                totalDurationMs={8000}
                mode="preview"
              />
            </View>
          </Card>
        ) : (
          /* Live Microphone Recording Card */
          <Card style={styles.contentCard} variant="elevated">
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Live Teacher Recording</Text>
                <Text style={styles.cardSubtitle}>
                  Reuses LiveConcertAudioEngine & Stage B-LIVE.5 Signal Foundation
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  isCapturing && styles.statusBadgeRecording,
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {isCapturing ? 'RECORDING' : isStarting ? 'STARTING' : 'READY'}
                </Text>
              </View>
            </View>

            {/* Real-Time Live Audio Signal Monitor */}
            <View style={styles.signalMonitor}>
              <Text style={styles.sectionHeading}>Live Microphone Monitor</Text>

              {/* RMS & Energy Levels */}
              <View style={styles.metersContainer}>
                <View style={styles.meterRow}>
                  <Text style={styles.meterLabel}>Input RMS:</Text>
                  <View style={styles.meterBarTrack}>
                    <View
                      style={[
                        styles.meterBarFill,
                        {
                          width: `${Math.round(
                            (features?.rms ?? 0) * 100
                          )}%`,
                          backgroundColor: theme.colors.sensory.read,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.meterValue}>
                    {Math.round((features?.rms ?? 0) * 100)}%
                  </Text>
                </View>

                <View style={styles.meterRow}>
                  <Text style={styles.meterLabel}>Low (Kick):</Text>
                  <View style={styles.meterBarTrack}>
                    <View
                      style={[
                        styles.meterBarFill,
                        {
                          width: `${Math.round(
                            (features?.lowEnergy ?? 0) * 100
                          )}%`,
                          backgroundColor: theme.colors.sensory.feel,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.meterValue}>
                    {Math.round((features?.lowEnergy ?? 0) * 100)}%
                  </Text>
                </View>

                <View style={styles.meterRow}>
                  <Text style={styles.meterLabel}>Mid (Snare):</Text>
                  <View style={styles.meterBarTrack}>
                    <View
                      style={[
                        styles.meterBarFill,
                        {
                          width: `${Math.round(
                            (features?.midEnergy ?? 0) * 100
                          )}%`,
                          backgroundColor: theme.colors.sensory.see,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.meterValue}>
                    {Math.round((features?.midEnergy ?? 0) * 100)}%
                  </Text>
                </View>
              </View>

              {/* Transient Attack Indicator */}
              <View style={styles.transientRow}>
                <View
                  style={[
                    styles.transientIndicator,
                    features?.isTransient && styles.transientIndicatorActive,
                  ]}
                />
                <Text style={styles.transientText}>
                  {features?.isTransient
                    ? '⚡ Transient Attack Detected!'
                    : 'Awaiting acoustic transient onset...'}
                </Text>
              </View>
            </View>

            {/* Recording Controls */}
            <View style={styles.recordControls}>
              {!isRecordingLive ? (
                <TouchableOpacity
                  style={styles.startRecordButton}
                  onPress={handleStartLiveRecord}
                  accessibilityLabel="Start recording teacher rhythm"
                  accessibilityRole="button"
                >
                  <Text style={styles.recordButtonIcon}>●</Text>
                  <Text style={styles.startRecordText}>
                    Start 4-Measure Recording
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.stopRecordButton}
                  onPress={handleStopLiveRecord}
                  accessibilityLabel="Stop recording"
                  accessibilityRole="button"
                >
                  <Text style={styles.stopRecordText}>
                    ■ Stop Recording ({Math.round(recordDurationMs / 1000)}s / 8s)
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Captured Hits Preview */}
            <View style={styles.timelineSection}>
              <View style={styles.capturedHeader}>
                <Text style={styles.sectionHeading}>
                  Captured Rhythm Stream ({capturedHits.length} events)
                </Text>
                {capturedHits.length === 0 && (
                  <TouchableOpacity
                    onPress={() =>
                      setCapturedHits(CANONICAL_ROCK_FOUNDATION_PATTERN.hits)
                    }
                  >
                    <Text style={styles.populateDemoLink}>
                      Use Sample Reference
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <PatternTimelineView
                hits={
                  capturedHits.length > 0
                    ? capturedHits
                    : CANONICAL_ROCK_FOUNDATION_PATTERN.hits
                }
                totalDurationMs={8000}
                mode="preview"
              />
            </View>
          </Card>
        )}

        {/* Engineering & ML Transparency Disclosure */}
        <Card style={styles.disclosureCard}>
          <Text style={styles.disclosureTitle}>
            🔬 Stage B-LIVE.5 Signal Foundation Integration
          </Text>
          <Text style={styles.disclosureText}>
            Teacher listening utilizes the live sliding-window frame processor
            with continuous sub-200Hz envelope tracking and global physical sample
            alignment. Real-time classifier currently maps frequency energy bands;
            Phase 2B will integrate full acoustic machine-learning drum classification.
          </Text>
        </Card>

        {/* Proceed to Practice Button */}
        <TouchableOpacity
          style={styles.proceedButton}
          onPress={handleSaveAndProceed}
          accessibilityLabel="Save reference track and proceed to Step 3: Feel & Memorize"
          accessibilityRole="button"
        >
          <Text style={styles.proceedButtonText}>
            Save Reference & Proceed to Practice →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.base,
  },
  scrollContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  sourceSelectorRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.surface,
    padding: 4,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: 6,
  },
  sourceTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
  },
  sourceTabActive: {
    backgroundColor: theme.colors.background.elevated,
    borderWidth: 1,
    borderColor: theme.colors.sensory.feel,
  },
  sourceTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.muted,
  },
  sourceTabTextActive: {
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
  contentCard: {
    gap: theme.spacing.sm,
    borderColor: theme.colors.border.subtle,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  cardSubtitle: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  readyBadge: {
    backgroundColor: theme.colors.status.success + '22',
    borderWidth: 1,
    borderColor: theme.colors.status.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  readyBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.status.success,
  },
  statusBadge: {
    backgroundColor: theme.colors.background.highlight,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  statusBadgeRecording: {
    backgroundColor: theme.colors.status.error + '22',
    borderColor: theme.colors.status.error,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.sizes.xs * theme.typography.lineHeights.normal,
  },
  timelineSection: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signalMonitor: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  metersContainer: {
    gap: 6,
    marginVertical: 4,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  meterLabel: {
    width: 75,
    fontSize: 10,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  meterBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.background.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  meterBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  meterValue: {
    width: 35,
    fontSize: 10,
    color: theme.colors.text.muted,
    textAlign: 'right',
    fontWeight: '600',
  },
  transientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  transientIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.border.bright,
  },
  transientIndicatorActive: {
    backgroundColor: theme.colors.status.success,
    shadowColor: theme.colors.status.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  transientText: {
    fontSize: 10,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  recordControls: {
    marginVertical: theme.spacing.xs,
  },
  startRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.status.error,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    gap: 8,
  },
  recordButtonIcon: {
    fontSize: 16,
    color: '#FFF',
  },
  startRecordText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: '#FFF',
  },
  stopRecordButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.highlight,
    borderWidth: 1,
    borderColor: theme.colors.status.error,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  stopRecordText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.status.error,
  },
  capturedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  populateDemoLink: {
    fontSize: 10,
    color: theme.colors.sensory.read,
    fontWeight: '600',
  },
  disclosureCard: {
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.background.elevated,
  },
  disclosureTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  disclosureText: {
    fontSize: 10,
    color: theme.colors.text.muted,
    lineHeight: 14,
  },
  proceedButton: {
    backgroundColor: theme.colors.sensory.feel,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    shadowColor: theme.colors.sensory.feel,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  proceedButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.text.inverted,
  },
});
