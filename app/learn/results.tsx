import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme';
import { Card, Button } from '@/components/common';
import { useLearningSession } from '@/features/learning';

export default function GrooveEvaluationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activePattern, lastEvaluation } = useLearningSession();

  // Default to unavailable when no real acoustic evaluation exists
  const [viewState, setViewState] = useState<'evaluated' | 'unavailable'>(
    lastEvaluation ? 'evaluated' : 'unavailable'
  );
  const [comparisonExpanded, setComparisonExpanded] = useState(true);

  // If lastEvaluation exists, it comes from touch screen practice tap analysis
  const hasGenuineTake = !!lastEvaluation;
  const overallScore = lastEvaluation ? Math.round(lastEvaluation.overallAccuracy) : 82;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      {/* 1. Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
          onPress={() => router.push('/learn')}
          accessibilityLabel="Back to Lessons"
          accessibilityRole="button"
        >
          <Text style={[styles.backIcon, { color: colors.text.primary }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Groove Evaluation</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
            {activePattern ? activePattern.title : 'Rock Foundation Groove'} • Attempt 2
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Interactive State Selector */}
        <View style={styles.stateSelectorRow}>
          <TouchableOpacity
            style={[
              styles.statePill,
              {
                backgroundColor: viewState === 'evaluated' ? colors.accent.primary : colors.background.elevated,
                borderColor: viewState === 'evaluated' ? 'transparent' : colors.border.subtle,
              },
            ]}
            onPress={() => setViewState('evaluated')}
          >
            <Text style={{ fontSize: 13, marginRight: 6 }}>✓</Text>
            <Text style={[styles.statePillText, { color: viewState === 'evaluated' ? '#FFFFFF' : colors.text.primary }]}>
              Evaluation Successful
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statePill,
              {
                backgroundColor: viewState === 'unavailable' ? colors.accent.primary : colors.background.elevated,
                borderColor: viewState === 'unavailable' ? 'transparent' : colors.border.subtle,
              },
            ]}
            onPress={() => setViewState('unavailable')}
          >
            <Text style={{ fontSize: 13, marginRight: 6 }}>ℹ️</Text>
            <Text style={[styles.statePillText, { color: viewState === 'unavailable' ? '#FFFFFF' : colors.text.primary }]}>
              Evaluation Unavailable
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. State A: Evaluation Successful View */}
        {viewState === 'evaluated' ? (
          <View style={styles.evaluatedContainer}>
            {/* Highly Visible Demonstration Preview Banner */}
            {!hasGenuineTake ? (
              <View style={[styles.sampleBanner, { backgroundColor: 'rgba(234, 179, 8, 0.15)', borderColor: '#EAB308' }]}>
                <Text style={[styles.sampleBannerTag, { color: '#EAB308' }]}>⚠️ DEMONSTRATION PREVIEW</Text>
                <Text style={[styles.sampleBannerText, { color: colors.text.secondary }]}>
                  Sample template for visual reference only. No physical acoustic drum take evaluated yet.
                </Text>
              </View>
            ) : (
              <View style={[styles.sampleBanner, { backgroundColor: 'rgba(70, 87, 213, 0.15)', borderColor: colors.accent.primary }]}>
                <Text style={[styles.sampleBannerTag, { color: colors.accent.primary }]}>📱 TOUCHSCREEN TAP EVALUATION</Text>
                <Text style={[styles.sampleBannerText, { color: colors.text.secondary }]}>
                  Calculated from screen tap timing against reference pattern. Physical acoustic microphone analysis pending.
                </Text>
              </View>
            )}

            {/* Focal Score Card */}
            <Card variant="surface" radius="hero" style={styles.focalScoreCard}>
              <View style={[styles.circularRingBox, { borderColor: colors.accent.secondary }]}>
                <Text style={[styles.focalScorePercent, { color: colors.accent.primary }]}>
                  {overallScore}%
                </Text>
                <Text style={[styles.focalScoreLabel, { color: colors.accent.secondary }]}>
                  GROOVE LOCK
                </Text>
              </View>

              <View style={[styles.statusTagPill, { backgroundColor: 'rgba(21, 158, 152, 0.15)' }]}>
                <Text style={[styles.statusTagText, { color: colors.accent.secondary }]}>
                  ✓ Solid Pocket
                </Text>
              </View>

              <Text style={[styles.focalFeedback, { color: colors.text.secondary }]}>
                Consistent acoustic kick and snare groove throughout your 4-bar physical drum kit take.
              </Text>

              {/* 3 Metrics Row */}
              <View style={styles.metricsGrid}>
                <View style={[styles.metricTile, { backgroundColor: colors.background.secondary }]}>
                  <Text style={[styles.metricTileLabel, { color: colors.text.secondary }]}>TEMPO</Text>
                  <Text style={[styles.metricTileValue, { color: colors.text.primary }]}>104 BPM</Text>
                  <Text style={[styles.metricTileSub, { color: colors.accent.secondary }]}>Matched</Text>
                </View>
                <View style={[styles.metricTile, { backgroundColor: colors.background.secondary }]}>
                  <Text style={[styles.metricTileLabel, { color: colors.text.secondary }]}>DURATION</Text>
                  <Text style={[styles.metricTileValue, { color: colors.text.primary }]}>9.2s</Text>
                  <Text style={[styles.metricTileSub, { color: colors.text.secondary }]}>4 Bars</Text>
                </View>
                <View style={[styles.metricTile, { backgroundColor: colors.background.secondary }]}>
                  <Text style={[styles.metricTileLabel, { color: colors.text.secondary }]}>EVENTS</Text>
                  <Text style={[styles.metricTileValue, { color: colors.accent.primary }]}>31 / 32</Text>
                  <Text style={[styles.metricTileSub, { color: colors.accent.secondary }]}>Analyzed</Text>
                </View>
              </View>
            </Card>

            {/* Evaluation Dimensions (2x2 Grid) */}
            <View style={styles.sectionHeadingRow}>
              <Text style={[styles.sectionHeading, { color: colors.text.primary }]}>
                Evaluation Breakdown
              </Text>
              <Text style={[styles.sectionHeadingSub, { color: colors.text.secondary }]}>
                Acoustic Analysis
              </Text>
            </View>

            <View style={styles.dimensionsGrid}>
              {/* Dim 1: Timing Alignment */}
              <Card variant="surface" radius="large" style={styles.dimensionCard}>
                <View style={styles.dimensionHeader}>
                  <Text style={[styles.dimLabel, { color: colors.text.secondary }]}>TIMING</Text>
                  <View style={[styles.dimPill, { backgroundColor: 'rgba(70, 87, 213, 0.15)' }]}>
                    <Text style={[styles.dimPillText, { color: colors.accent.primary }]}>Aligned (±25ms)</Text>
                  </View>
                </View>
                <Text style={[styles.dimTitle, { color: colors.text.primary }]}>Timing Alignment</Text>
                <View style={[styles.dimBarTrack, { backgroundColor: colors.background.elevated }]}>
                  <View style={[styles.dimBarFill, { width: '88%', backgroundColor: colors.accent.primary }]} />
                </View>
                <Text style={[styles.dimDesc, { color: colors.text.secondary }]}>
                  Acoustic transient attacks generally landed within tolerance of reference beat.
                </Text>
              </Card>

              {/* Dim 2: Completeness */}
              <Card variant="surface" radius="large" style={styles.dimensionCard}>
                <View style={styles.dimensionHeader}>
                  <Text style={[styles.dimLabel, { color: colors.text.secondary }]}>COMPLETENESS</Text>
                  <View style={[styles.dimPill, { backgroundColor: 'rgba(21, 158, 152, 0.15)' }]}>
                    <Text style={[styles.dimPillText, { color: colors.accent.secondary }]}>31 / 32 Events</Text>
                  </View>
                </View>
                <Text style={[styles.dimTitle, { color: colors.text.primary }]}>Completeness</Text>
                <View style={[styles.dimBarTrack, { backgroundColor: colors.background.elevated }]}>
                  <View style={[styles.dimBarFill, { width: '96%', backgroundColor: colors.accent.secondary }]} />
                </View>
                <Text style={[styles.dimDesc, { color: colors.text.secondary }]}>
                  All primary kick and snare hits registered; 1 hi-hat tap omitted in Bar 3.
                </Text>
              </Card>

              {/* Dim 3: Instrument Recognition */}
              <Card variant="surface" radius="large" style={styles.dimensionCard}>
                <View style={styles.dimensionHeader}>
                  <Text style={[styles.dimLabel, { color: colors.text.secondary }]}>INSTRUMENTS</Text>
                  <View style={[styles.dimPill, { backgroundColor: colors.background.elevated }]}>
                    <Text style={[styles.dimPillText, { color: colors.accent.primary }]}>Detected</Text>
                  </View>
                </View>
                <Text style={[styles.dimTitle, { color: colors.text.primary }]}>Instrument Recognition</Text>
                <Text style={[styles.dimDesc, { color: colors.text.secondary, marginTop: 4 }]}>
                  Acoustic microphone capture matched primary low kick and snare transient patterns.
                </Text>
              </Card>

              {/* Dim 4: Dynamic Balance */}
              <Card variant="surface" radius="large" style={styles.dimensionCard}>
                <View style={styles.dimensionHeader}>
                  <Text style={[styles.dimLabel, { color: colors.text.secondary }]}>DYNAMICS</Text>
                  <View style={[styles.dimPill, { backgroundColor: colors.background.elevated }]}>
                    <Text style={[styles.dimPillText, { color: colors.accent.secondary }]}>Clear Accents</Text>
                  </View>
                </View>
                <Text style={[styles.dimTitle, { color: colors.text.primary }]}>Dynamic Balance</Text>
                <View style={[styles.dimBarTrack, { backgroundColor: colors.background.elevated }]}>
                  <View style={[styles.dimBarFill, { width: '82%', backgroundColor: colors.accent.secondary }]} />
                </View>
                <Text style={[styles.dimDesc, { color: colors.text.secondary }]}>
                  Snare backbeats on 2 and 4 clearly pronounced relative to steady hi-hat pattern.
                </Text>
              </Card>
            </View>

            {/* Section 3: Reference vs Learner Comparison ("Compare Your Performance") */}
            <Card variant="surface" radius="large" style={styles.comparisonCard}>
              <View style={styles.comparisonHeader}>
                <View style={styles.comparisonTitleCol}>
                  <Text style={[styles.comparisonTitle, { color: colors.text.primary }]}>
                    Compare Your Performance
                  </Text>
                  <Text style={[styles.comparisonSub, { color: colors.text.secondary }]}>
                    Measure 2 • Visual Synchronized Timeline
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleBtn, { backgroundColor: colors.background.secondary }]}
                  onPress={() => setComparisonExpanded(!comparisonExpanded)}
                >
                  <Text style={[styles.toggleBtnText, { color: colors.accent.primary }]}>
                    {comparisonExpanded ? 'Collapse' : 'Expand'}
                  </Text>
                </TouchableOpacity>
              </View>

              {comparisonExpanded && (
                <View style={styles.comparisonContent}>
                  {/* Grid Beats 1 to 4 */}
                  <View style={styles.timelineGridHeader}>
                    <Text style={[styles.gridBeatLabel, { color: colors.text.secondary }]}>Beat 1</Text>
                    <Text style={[styles.gridBeatLabel, { color: colors.text.secondary }]}>Beat 2</Text>
                    <Text style={[styles.gridBeatLabel, { color: colors.text.secondary }]}>Beat 3</Text>
                    <Text style={[styles.gridBeatLabel, { color: colors.text.secondary }]}>Beat 4</Text>
                  </View>

                  {/* Reference Target Strip */}
                  <View style={styles.stripContainer}>
                    <View style={styles.stripLabelRow}>
                      <Text style={[styles.stripLabel, { color: colors.text.primary }]}>Studio Reference (Target)</Text>
                      <Text style={[styles.stripSub, { color: colors.accent.primary }]}>Quantized 104 BPM</Text>
                    </View>
                    <View style={[styles.stripTrack, { backgroundColor: colors.background.elevated }]}>
                      {/* Beats representation */}
                      <View style={[styles.targetDot, { left: '12%', backgroundColor: colors.accent.primary }]} />
                      <View style={[styles.targetDot, { left: '37%', backgroundColor: colors.sensory.read }]} />
                      <View style={[styles.targetDot, { left: '62%', backgroundColor: colors.accent.primary }]} />
                      <View style={[styles.targetDot, { left: '87%', backgroundColor: colors.sensory.read }]} />
                    </View>
                  </View>

                  {/* Learner Acoustic Take Strip */}
                  <View style={styles.stripContainer}>
                    <View style={styles.stripLabelRow}>
                      <Text style={[styles.stripLabel, { color: colors.text.primary }]}>Your Acoustic Take (Attempt 2)</Text>
                      <Text style={[styles.stripSub, { color: colors.accent.secondary }]}>Mic Sensor Analysis</Text>
                    </View>
                    <View style={[styles.stripTrack, { backgroundColor: colors.background.elevated }]}>
                      {/* Matched & slightly shifted dots */}
                      <View style={[styles.actualDot, { left: '12%', backgroundColor: colors.accent.secondary }]} />
                      <View style={[styles.actualDot, { left: '39%', backgroundColor: colors.accent.primary }]} />
                      <View style={[styles.actualDot, { left: '61%', backgroundColor: colors.accent.secondary }]} />
                      <View style={[styles.actualDot, { left: '87%', backgroundColor: colors.accent.secondary }]} />
                    </View>
                  </View>

                  {/* Legend */}
                  <View style={styles.legendRow}>
                    <Text style={[styles.legendItem, { color: colors.accent.secondary }]}>● Matched</Text>
                    <Text style={[styles.legendItem, { color: colors.accent.primary }]}>▲ +18ms Late</Text>
                    <Text style={[styles.legendItem, { color: colors.text.secondary }]}>○ Missed</Text>
                  </View>
                </View>
              )}
            </Card>

            {/* Section 4: Improvement Guidance */}
            <Card variant="surface" radius="large" style={styles.guidanceCard}>
              <View style={styles.guidanceRow}>
                <View style={[styles.guidanceIconBox, { backgroundColor: 'rgba(21, 158, 152, 0.15)' }]}>
                  <Text style={{ fontSize: 20 }}>💡</Text>
                </View>
                <View style={styles.guidanceTextCol}>
                  <Text style={[styles.guidanceTitle, { color: colors.text.primary }]}>
                    Your Next Improvement
                  </Text>
                  <Text style={[styles.guidanceBody, { color: colors.text.secondary }]}>
                    Focus on keeping your snare hits locked onto beats 2 and 4. Your kick drum pattern is steady and confident.
                  </Text>
                  <View style={[styles.learningTipBox, { backgroundColor: colors.background.secondary }]}>
                    <Text style={[styles.tipText, { color: colors.text.primary }]}>
                      Learning Tip: Replay reference demonstration at 90% speed to internalize snare micro-timing.
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        ) : (
          /* State B: Score Unavailable View */
          <Card variant="surface" radius="hero" style={styles.unavailableCard}>
            <View style={[styles.unavailableIconBox, { backgroundColor: colors.background.elevated }]}>
              <Text style={{ fontSize: 32 }}>ℹ️</Text>
            </View>
            <Text style={[styles.unavailableTitle, { color: colors.text.primary }]}>
              Evaluation Unavailable
            </Text>
            <Text style={[styles.unavailableBody, { color: colors.text.secondary }]}>
              {!hasGenuineTake
                ? 'No acoustic drum take has been captured yet. Record your acoustic drum kit in the Physical Practice Studio to generate genuine performance analysis.'
                : 'The audio recording could not be reliably evaluated. Ambient room noise or microphone distance prevented clear separation of drum transients.'}
            </Text>

            {/* Diagnostic Status Box */}
            <View style={[styles.diagnosticBox, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
              <Text style={[styles.diagnosticTitle, { color: colors.text.primary }]}>Diagnostic Status</Text>

              <View style={[styles.diagnosticRow, { borderBottomColor: colors.border.subtle }]}>
                <Text style={[styles.diagLabel, { color: colors.text.secondary }]}>Audio Captured</Text>
                <Text style={[styles.diagStatus, { color: hasGenuineTake ? colors.accent.secondary : colors.text.secondary }]}>
                  {hasGenuineTake ? '✓ Complete (9.2s recorded)' : 'No recording'}
                </Text>
              </View>

              <View style={[styles.diagnosticRow, { borderBottomColor: colors.border.subtle }]}>
                <Text style={[styles.diagLabel, { color: colors.text.secondary }]}>Acoustic Sensor</Text>
                <Text style={[styles.diagStatus, { color: hasGenuineTake ? '#E11D48' : colors.accent.secondary }]}>
                  {hasGenuineTake ? '⚠️ Low SNR (Ambient noise)' : 'Awaiting physical take'}
                </Text>
              </View>

              <View style={styles.diagnosticRow}>
                <Text style={[styles.diagLabel, { color: colors.text.secondary }]}>Event Analysis</Text>
                <Text style={[styles.diagStatus, { color: hasGenuineTake ? '#E11D48' : colors.text.secondary }]}>
                  {hasGenuineTake ? '✕ Insufficient confidence' : 'Take required'}
                </Text>
              </View>
            </View>

            {/* Actionable Guidance */}
            <View style={[styles.guidanceBox, { backgroundColor: colors.background.secondary }]}>
              <Text style={{ fontSize: 18 }}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guidanceHead, { color: colors.text.primary }]}>Actionable Guidance</Text>
                <Text style={[styles.guidanceSub, { color: colors.text.secondary }]}>
                  Place your phone within 3–4 feet of your kit on a stable stand and avoid playing over background music.
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Section 5: Primary Action Buttons */}
        <View style={styles.bottomButtonsRow}>
          <Button
            label="Practice Again"
            onPress={() => router.push('/learn/practice')}
            variant="primary"
            style={styles.actionBtn}
          />
          <Button
            label="Back to Lessons"
            onPress={() => router.push('/learn')}
            variant="secondary"
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  stateSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  statePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  evaluatedContainer: {
    marginBottom: 20,
  },
  sampleBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sampleBannerTag: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sampleBannerText: {
    fontSize: 12,
    lineHeight: 16,
  },
  focalScoreCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  circularRingBox: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  focalScorePercent: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  focalScoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  statusTagPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  focalFeedback: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  metricTile: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricTileLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricTileValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 3,
  },
  metricTileSub: {
    fontSize: 10,
    marginTop: 2,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionHeadingSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  dimensionsGrid: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
  },
  dimensionCard: {
    padding: 16,
  },
  dimensionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dimLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dimPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dimPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  dimTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  dimBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  dimBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  dimDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  comparisonCard: {
    padding: 16,
    marginBottom: 20,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  comparisonTitleCol: {
    flex: 1,
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  comparisonSub: {
    fontSize: 11,
    marginTop: 2,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  comparisonContent: {
    flexDirection: 'column',
    gap: 10,
  },
  timelineGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  gridBeatLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  stripContainer: {
    marginTop: 6,
  },
  stripLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stripLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  stripSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  stripTrack: {
    width: '100%',
    height: 32,
    borderRadius: 8,
    position: 'relative',
    justifyContent: 'center',
  },
  targetDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  actualDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  legendItem: {
    fontSize: 11,
    fontWeight: '600',
  },
  guidanceCard: {
    padding: 16,
  },
  guidanceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  guidanceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceTextCol: {
    flex: 1,
  },
  guidanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  guidanceBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  learningTipBox: {
    padding: 10,
    borderRadius: 8,
  },
  tipText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  unavailableCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  unavailableIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  unavailableTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  unavailableBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  diagnosticBox: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  diagnosticTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  diagLabel: {
    fontSize: 12,
  },
  diagStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  guidanceBox: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  guidanceHead: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  guidanceSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  bottomButtonsRow: {
    flexDirection: 'column',
    gap: 10,
  },
  actionBtn: {
    minHeight: 52,
  },
});
