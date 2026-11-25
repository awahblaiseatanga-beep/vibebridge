import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '@/theme';
import { TrackMetadata, TrackProcessingProgress } from '@/types';
import { formatMilliseconds } from '@/utils';

interface TrackProcessingCardProps {
  track: TrackMetadata;
  progress?: TrackProcessingProgress;
  onRetry?: (trackId: string) => void;
  onDelete?: (trackId: string) => void;
}

export function TrackProcessingCard({
  track,
  progress,
  onRetry,
  onDelete,
}: TrackProcessingCardProps) {
  const { colors } = useAppTheme();

  const stage = progress?.stage || (track.analysisStatus as any) || 'importing';
  const isFailed = stage === 'failed' || track.analysisStatus === 'failed';
  const isReady = stage === 'ready' || track.analysisStatus === 'ready';

  // Format stage label
  let stageLabel = 'Importing Audio File...';
  let stageColor = colors.accent.primary;
  let stageIcon = '📥';

  if (stage === 'decoding') {
    stageLabel = 'Decoding to PCM Samples...';
    stageColor = colors.accent.secondary;
    stageIcon = '⚙️';
  } else if (stage === 'analyzing') {
    stageLabel = 'Analyzing Rhythms & Onsets...';
    stageColor = '#E2B842'; // warm gold
    stageIcon = '🎵';
  } else if (stage === 'saving') {
    stageLabel = 'Saving Sensory Timeline...';
    stageColor = colors.accent.primary;
    stageIcon = '💾';
  } else if (isReady) {
    stageLabel = 'Ready to Play';
    stageColor = colors.accent.secondary;
    stageIcon = '⚡';
  } else if (isFailed) {
    stageLabel = 'Analysis Incomplete';
    stageColor = '#EB5757'; // warning red
    stageIcon = '⚠️';
  }

  // Calculate real progress
  const processedMs = progress?.processedDurationMs || 0;
  const totalMs = progress?.totalDurationMs || track.durationMs || 0;
  const ratio = totalMs > 0 ? Math.min(1.0, Math.max(0, processedMs / totalMs)) : 0;
  const progressPercent = Math.round(ratio * 100);

  const formatText = (track.mimeType?.split('/')[1] || track.uri.split('.').pop() || 'AUDIO').toUpperCase();

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: colors.background.elevated,
          borderColor: isFailed ? '#EB5757' : isReady ? colors.accent.secondary : colors.border.subtle,
        },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Audio processing: ${track.title}, stage: ${stageLabel}`}
    >
      {/* Top Row: Track Icon, Meta, Stage & Format Pill */}
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: colors.background.secondary }]}>
          {isFailed ? (
            <Text style={styles.iconText}>⚠️</Text>
          ) : isReady ? (
            <Text style={styles.iconText}>⚡</Text>
          ) : (
            <ActivityIndicator size="small" color={stageColor} />
          )}
        </View>

        <View style={styles.titleCol}>
          <Text style={[styles.trackTitle, { color: colors.text.primary }]} numberOfLines={1}>
            {track.title}
          </Text>
          <View style={styles.stageRow}>
            <Text style={[styles.stageText, { color: stageColor }]}>
              {stageIcon} {stageLabel}
            </Text>
          </View>
        </View>

        <View style={[styles.formatPill, { backgroundColor: colors.background.secondary }]}>
          <Text style={[styles.formatText, { color: colors.accent.secondary }]}>{formatText}</Text>
        </View>
      </View>

      {/* Track-Shaped Horizontal Progress Track with Playhead */}
      {!isFailed && !isReady && (
        <View style={styles.progressSection}>
          <View style={[styles.stemTrack, { backgroundColor: colors.background.secondary }]}>
            <View
              style={[
                styles.stemFill,
                {
                  width: `${Math.max(4, progressPercent)}%`,
                  backgroundColor: stageColor,
                },
              ]}
            />
            {totalMs > 0 && (
              <View
                style={[
                  styles.stemPlayhead,
                  {
                    left: `${Math.min(98, Math.max(0, progressPercent))}%`,
                    backgroundColor: '#FFFFFF',
                  },
                ]}
              />
            )}
          </View>

          {/* Meaningful Real Duration Readout */}
          <View style={styles.metricsRow}>
            <Text style={[styles.metricText, { color: colors.text.secondary }]}>
              {totalMs > 0
                ? `${formatMilliseconds(processedMs)} / ${formatMilliseconds(totalMs)}`
                : progress?.detailMessage || 'Decoding audio frames...'}
            </Text>
            {progress?.sampleRate ? (
              <Text style={[styles.metricText, { color: colors.text.secondary }]}>
                {progress.sampleRate} Hz • {progress.channelCount === 1 ? 'Mono' : 'Stereo'}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Failure Message & Retry Button */}
      {isFailed && (
        <View style={styles.failedRow}>
          <Text style={[styles.failedText, { color: colors.text.secondary }]} numberOfLines={2}>
            {track.summaryNote || 'Audio decoding or analysis could not complete.'}
          </Text>
          <View style={styles.actionBtnRow}>
            {onRetry && (
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: colors.accent.primary }]}
                onPress={() => onRetry(track.id)}
                accessibilityLabel="Retry audio analysis"
              >
                <Text style={styles.retryBtnText}>↻ Retry</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.background.secondary }]}
                onPress={() => onDelete(track.id)}
                accessibilityLabel="Remove track"
              >
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginVertical: 4,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formatPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formatText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressSection: {
    gap: 6,
  },
  stemTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  stemFill: {
    height: '100%',
    borderRadius: 4,
  },
  stemPlayhead: {
    position: 'absolute',
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricText: {
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 4,
  },
  failedText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 12,
  },
});
