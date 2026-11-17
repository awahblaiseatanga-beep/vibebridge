import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  GestureResponderEvent,
} from 'react-native';
import { theme } from '@/theme';
import { Card } from '@/components/common';
import { formatMilliseconds } from '@/utils';
import { eventScheduler } from '@/engines/event-scheduler';
import { scheduleDemoTrackSensoryCues } from '@/features/rhythm';
import { lyricsEngine } from '@/engines/lyrics';
import { DEMO_TRACK_LYRICS } from '@/features/lyrics';
import { usePlayback } from '../usePlayback';

// Bundled demo audio stem (12-second 120 BPM rhythmic track)
const DEMO_AUDIO_ASSET = require('@assets/music/vibebridge_demo.wav');

export const NowPlayingCard: React.FC = () => {
  const {
    positionMs,
    durationMs,
    status,
    isBuffering,
    errorMessage,
    timelineRevision,
    isPlaying,
    isPaused,
    isLoading,
    isStopped,
    isIdle,
    load,
    play,
    pause,
    resume,
    stop,
    seek,
  } = usePlayback();

  const [trackName, setTrackName] = useState<string>('VibeBridge 120 BPM Showcase');
  const [trackArtist, setTrackArtist] = useState<string>('Accessibility Rhythm Stem');
  const [trackType, setTrackType] = useState<string>('Bundled Asset (.wav)');

  // Auto-load bundled demo track on mount if currently idle
  useEffect(() => {
    if (isIdle) {
      lyricsEngine.loadLyrics(DEMO_TRACK_LYRICS);
      load({
        type: 'bundle',
        assetId: DEMO_AUDIO_ASSET,
        name: 'VibeBridge 120 BPM Showcase',
        durationMs: 12000,
      }).catch((e) => {
        console.warn('Auto-load demo audio notice:', e);
      });
    }
  }, [isIdle, load]);

  // Synchronize demo track rhythmic sensory cues (haptic + visual) whenever timeline revision changes (track load or seek)
  useEffect(() => {
    if (timelineRevision > 0) {
      scheduleDemoTrackSensoryCues(eventScheduler, timelineRevision);
    }
  }, [timelineRevision]);

  const handlePlayPause = async () => {
    if (isIdle) {
      lyricsEngine.loadLyrics(DEMO_TRACK_LYRICS);
      await load({
        type: 'bundle',
        assetId: DEMO_AUDIO_ASSET,
        name: 'VibeBridge 120 BPM Showcase',
        durationMs: 12000,
      });
      await play();
    } else if (isPlaying) {
      await pause();
    } else if (isPaused || isStopped) {
      await resume();
    }
  };

  const handleStop = async () => {
    await stop();
  };

  const handleSeekRelative = async (offsetMs: number) => {
    const target = Math.max(0, Math.min(positionMs + offsetMs, durationMs || 12000));
    await seek(target);
  };

  const handleProgressBarPress = async (event: GestureResponderEvent) => {
    if (durationMs <= 0) return;
    const { locationX } = event.nativeEvent;
    // Assume full container width roughly minus padding or estimate relative position
    // For reliable relative seeking, we use quick-seek points below as well
    const ratio = Math.max(0, Math.min(locationX / 280, 1));
    const targetMs = Math.round(ratio * durationMs);
    await seek(targetMs);
  };

  const progressPercent = durationMs > 0 ? Math.min(100, Math.max(0, (positionMs / durationMs) * 100)) : 0;

  const getStatusBadgeColor = () => {
    switch (status) {
      case 'playing':
        return theme.colors.status.success;
      case 'paused':
        return theme.colors.status.warning;
      case 'loading':
        return theme.colors.sensory.read;
      case 'error':
        return theme.colors.status.error;
      case 'stopped':
      default:
        return theme.colors.text.muted;
    }
  };

  return (
    <Card style={styles.card} variant="elevated">
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.sectionTitle}>Now Playing</Text>
          <Text style={styles.trackSubtitle}>{trackType}</Text>
        </View>

        <View style={[styles.statusBadge, { borderColor: getStatusBadgeColor() }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusBadgeColor() }]} />
          <Text style={[styles.statusText, { color: getStatusBadgeColor() }]}>
            {isLoading ? 'LOADING' : status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Track Details */}
      <View style={styles.trackInfoContainer}>
        <View style={styles.albumArtPlaceholder}>
          <Text style={styles.albumArtIcon}>🎵</Text>
        </View>
        <View style={styles.metadataContainer}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {trackName}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {trackArtist}
          </Text>
          <Text style={styles.clockDebugHint}>
            Authoritative Clock: {positionMs} ms
          </Text>
        </View>
      </View>

      {/* Progress Bar & Timestamps */}
      <View style={styles.progressContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleProgressBarPress}
          style={styles.progressBarTrack}
        >
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPercent}%` },
            ]}
          />
        </TouchableOpacity>

        <View style={styles.timestampRow}>
          <Text style={styles.timestampText}>
            {formatMilliseconds(positionMs)}
          </Text>
          {isBuffering ? (
            <Text style={styles.bufferingText}>Buffering...</Text>
          ) : null}
          <Text style={styles.timestampText}>
            {formatMilliseconds(durationMs)}
          </Text>
        </View>
      </View>

      {/* Quick Seek Points */}
      <View style={styles.seekRow}>
        <TouchableOpacity
          style={styles.seekButton}
          onPress={() => handleSeekRelative(-2000)}
          disabled={isLoading}
        >
          <Text style={styles.seekButtonText}>-2s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.seekButton}
          onPress={() => seek(0)}
          disabled={isLoading}
        >
          <Text style={styles.seekButtonText}>0s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.seekButton}
          onPress={() => seek(Math.round(durationMs * 0.5))}
          disabled={isLoading || durationMs <= 0}
        >
          <Text style={styles.seekButtonText}>50%</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.seekButton}
          onPress={() => handleSeekRelative(2000)}
          disabled={isLoading}
        >
          <Text style={styles.seekButtonText}>+2s</Text>
        </TouchableOpacity>
      </View>

      {/* Primary Transport Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, isStopped && styles.activeSecondaryButton]}
          onPress={handleStop}
          disabled={isLoading || isIdle}
        >
          <Text style={styles.secondaryButtonText}>⏹ Stop</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.playButton,
            isPlaying ? styles.pauseButton : styles.playActiveButton,
          ]}
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          <Text style={styles.playButtonText}>
            {isLoading ? '⏳ Loading...' : isPlaying ? '⏸ Pause' : '▶ Play'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => handleSeekRelative(durationMs)}
          disabled={isLoading || isIdle}
        >
          <Text style={styles.secondaryButtonText}>⏭ End</Text>
        </TouchableOpacity>
      </View>

      {/* Error Message banner if any */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Authoritative Clock Telemetry Card */}
      <View style={styles.telemetryCard}>
        <Text style={styles.telemetryTitle}>Master Audio Clock (Sensory Sync Source)</Text>
        <View style={styles.telemetryGrid}>
          <Text style={styles.telemetryItem}>
            Time: <Text style={styles.telemetryValue}>{positionMs}ms</Text>
          </Text>
          <Text style={styles.telemetryItem}>
            Duration: <Text style={styles.telemetryValue}>{durationMs}ms</Text>
          </Text>
          <Text style={styles.telemetryItem}>
            Status: <Text style={styles.telemetryValue}>{status}</Text>
          </Text>
          <Text style={styles.telemetryItem}>
            Revision: <Text style={styles.telemetryValue}>rev {timelineRevision}</Text>
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  trackSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.sensory.read,
    fontWeight: theme.typography.weights.medium,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    backgroundColor: theme.colors.background.highlight,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: theme.typography.sizes.xs - 2,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.5,
  },
  trackInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  albumArtPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.highlight,
    borderWidth: 1,
    borderColor: theme.colors.border.bright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumArtIcon: {
    fontSize: 24,
  },
  metadataContainer: {
    flex: 1,
    gap: 2,
  },
  trackTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  artistName: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
  },
  clockDebugHint: {
    fontSize: theme.typography.sizes.xs - 2,
    color: theme.colors.text.muted,
    fontVariant: ['tabular-nums'],
  },
  progressContainer: {
    gap: theme.spacing.xs,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.background.highlight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.sensory.read,
    borderRadius: 4,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestampText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.muted,
    fontVariant: ['tabular-nums'],
  },
  bufferingText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.status.warning,
    fontWeight: theme.typography.weights.semibold,
  },
  seekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  seekButton: {
    flex: 1,
    paddingVertical: theme.spacing.xs,
    alignItems: 'center',
    backgroundColor: theme.colors.background.highlight,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  seekButtonText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.semibold,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  playButton: {
    flex: 2,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playActiveButton: {
    backgroundColor: theme.colors.sensory.read,
  },
  pauseButton: {
    backgroundColor: theme.colors.status.warning,
  },
  playButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.background.base,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.highlight,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSecondaryButton: {
    borderColor: theme.colors.border.bright,
  },
  secondaryButtonText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  errorBanner: {
    padding: theme.spacing.sm,
    backgroundColor: '#3F1219',
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.status.error,
  },
  errorText: {
    fontSize: theme.typography.sizes.xs,
    color: '#FECDD3',
  },
  telemetryCard: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background.base,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: theme.spacing.xxs,
  },
  telemetryTitle: {
    fontSize: theme.typography.sizes.xs - 2,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.sensory.read,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  telemetryItem: {
    fontSize: theme.typography.sizes.xs - 2,
    color: theme.colors.text.muted,
  },
  telemetryValue: {
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weights.semibold,
    fontVariant: ['tabular-nums'],
  },
});
