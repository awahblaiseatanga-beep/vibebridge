/**
 * PatternTimelineView
 *
 * Multi-measure horizontal visual rhythm ribbon for tactile drum learning.
 * Renders color-coded drum transients (Kick: Rose, Snare: Purple, Hi-Hat: Cyan)
 * across 4 bars with beat subdivisions, playhead cursor, and comparison tracks.
 */

import React from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import { theme } from '@/theme';
import { DrumHit, DrumType, HitAlignment, UserPracticeTap } from '../types';

interface PatternTimelineViewProps {
  hits: DrumHit[];
  totalDurationMs?: number;
  currentTimeMs?: number;
  isPlaying?: boolean;
  alignments?: HitAlignment[];
  userTaps?: UserPracticeTap[];
  mode?: 'preview' | 'dual_comparison';
}

const DRUM_COLORS: Record<DrumType, string> = {
  kick: theme.colors.sensory.feel,   // Coral / Rose
  snare: theme.colors.sensory.see,   // Electric Violet
  hihat: theme.colors.sensory.read,  // Sky Cyan
  uncertain: theme.colors.text.muted,
};

const DRUM_LABELS: Record<DrumType, string> = {
  kick: 'K',
  snare: 'S',
  hihat: 'H',
  uncertain: '?',
};

export const PatternTimelineView: React.FC<PatternTimelineViewProps> = ({
  hits,
  totalDurationMs = 8000,
  currentTimeMs = 0,
  isPlaying = false,
  alignments,
  userTaps,
  mode = 'preview',
}) => {
  const progressPercent = Math.max(
    0,
    Math.min(100, (currentTimeMs / totalDurationMs) * 100)
  );

  return (
    <View style={styles.container}>
      {/* Measure / Bar Header Markers */}
      <View style={styles.barHeaderRow}>
        {[1, 2, 3, 4].map((barNum) => (
          <View key={barNum} style={styles.barHeaderCell}>
            <Text style={styles.barHeaderText}>Bar {barNum}</Text>
          </View>
        ))}
      </View>

      {/* Main Track Ribbon */}
      <View style={styles.ribbonContainer}>
        {/* Bar divider grid lines */}
        <View style={styles.gridOverlay}>
          <View style={[styles.gridLine, { left: '25%' }]} />
          <View style={[styles.gridLine, { left: '50%' }]} />
          <View style={[styles.gridLine, { left: '75%' }]} />
        </View>

        {/* Playhead Cursor */}
        {isPlaying && (
          <View
            style={[
              styles.playheadCursor,
              { left: `${progressPercent}%` },
            ]}
          />
        )}

        {/* Reference / Teacher Track */}
        <View style={styles.trackRow}>
          <View style={styles.trackLabelContainer}>
            <Text style={styles.trackLabel}>
              {mode === 'dual_comparison' ? 'TEACHER' : 'TARGET'}
            </Text>
          </View>
          <View style={styles.trackBody}>
            {hits.map((hit) => {
              const leftPercent = (hit.timestampMs / totalDurationMs) * 100;
              const color = DRUM_COLORS[hit.drum];
              const isKickOrSnare = hit.drum === 'kick' || hit.drum === 'snare';

              return (
                <View
                  key={hit.id}
                  style={[
                    styles.hitNode,
                    {
                      left: `${leftPercent}%`,
                      borderColor: color,
                      backgroundColor: isKickOrSnare ? color : 'transparent',
                      width: isKickOrSnare ? 16 : 8,
                      height: isKickOrSnare ? 16 : 8,
                      borderRadius: isKickOrSnare ? 8 : 4,
                      zIndex: isKickOrSnare ? 3 : 1,
                    },
                  ]}
                >
                  {isKickOrSnare && (
                    <Text style={styles.hitNodeText}>
                      {DRUM_LABELS[hit.drum]}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Comparison / Learner Track (if in dual_comparison mode) */}
        {mode === 'dual_comparison' && (
          <View style={[styles.trackRow, styles.learnerTrackRow]}>
            <View style={styles.trackLabelContainer}>
              <Text style={styles.trackLabelLearner}>YOU</Text>
            </View>
            <View style={styles.trackBody}>
              {alignments
                ? alignments.map((align, idx) => {
                    const hit = align.targetHit;
                    const leftPercent = (hit.timestampMs / totalDurationMs) * 100;
                    let alignColor: string = theme.colors.status.success; // On time
                    if (align.status === 'early' || align.status === 'late') {
                      alignColor = theme.colors.status.warning;
                    } else if (align.status === 'missed') {
                      alignColor = theme.colors.status.error;
                    }

                    return (
                      <View
                        key={`align-${hit.id}-${idx}`}
                        style={[
                          styles.hitNode,
                          {
                            left: `${leftPercent}%`,
                            borderColor: alignColor,
                            backgroundColor:
                              align.status === 'missed'
                                ? 'transparent'
                                : alignColor,
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            zIndex: 4,
                          },
                        ]}
                      >
                        <Text style={styles.learnerNodeText}>
                          {align.status === 'missed'
                            ? '×'
                            : align.status === 'on_time'
                            ? '✓'
                            : '!'}
                        </Text>
                      </View>
                    );
                  })
                : userTaps?.map((tap) => {
                    const leftPercent = (tap.timestampMs / totalDurationMs) * 100;
                    const color = DRUM_COLORS[tap.drum];
                    return (
                      <View
                        key={tap.id}
                        style={[
                          styles.hitNode,
                          {
                            left: `${leftPercent}%`,
                            borderColor: color,
                            backgroundColor: color,
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            zIndex: 4,
                          },
                        ]}
                      >
                        <Text style={styles.hitNodeText}>
                          {DRUM_LABELS[tap.drum]}
                        </Text>
                      </View>
                    );
                  })}
            </View>
          </View>
        )}
      </View>

      {/* Legend Row */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: DRUM_COLORS.kick }]}
          />
          <Text style={styles.legendText}>Kick (Bass)</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: DRUM_COLORS.snare }]}
          />
          <Text style={styles.legendText}>Snare (Crack)</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: DRUM_COLORS.hihat }]}
          />
          <Text style={styles.legendText}>Hi-Hat (Tick)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  barHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
    paddingBottom: 4,
  },
  barHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  barHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ribbonContainer: {
    position: 'relative',
    height: 70,
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: theme.colors.border.bright,
    opacity: 0.4,
  },
  playheadCursor: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.colors.sensory.feel,
    zIndex: 10,
    shadowColor: theme.colors.sensory.feel,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: 4,
  },
  learnerTrackRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  trackLabelContainer: {
    width: 50,
  },
  trackLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    letterSpacing: 0.5,
  },
  trackLabelLearner: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.sensory.read,
    letterSpacing: 0.5,
  },
  trackBody: {
    flex: 1,
    position: 'relative',
    height: 24,
    justifyContent: 'center',
  },
  hitNode: {
    position: 'absolute',
    top: '50%',
    marginTop: -7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitNodeText: {
    fontSize: 8,
    fontWeight: '800',
    color: theme.colors.text.inverted,
  },
  learnerNodeText: {
    fontSize: 8,
    fontWeight: '900',
    color: theme.colors.text.inverted,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
});
