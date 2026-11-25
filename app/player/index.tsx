import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme';
import { Card, Button } from '@/components/common';
import { usePlayback } from '@/features/playback';
import { useHaptics } from '@/features/haptics';
import { useVisualizer } from '@/features/visualizer';
import { formatMilliseconds } from '@/utils';
import { useLocalMusicLibrary } from '@/features/library';
import { BUNDLED_SPHERES_TRACK } from '@/services/tracks';
import { isTrackPlayable } from '@/types';

const spheresArtwork = require('../../assets/images/player/spheres-album-art.png');

export default function StandardMusicPlayerScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const playback = usePlayback();
  const {
    positionMs,
    durationMs,
    isPlaying,
    isIdle,
    isPaused,
    isStopped,
    timelineRevision,
    load,
    play,
    pause,
    resume,
    seek,
  } = playback;

  const { activeTrack, loadedTrackId, loadTrack, playTrack } = useLocalMusicLibrary();
  const { enabled: hapticsEnabled, toggleEnabled: toggleHaptics, triggerTest } = useHaptics();
  const {
    enabled: visualEnabled,
    reducedMotion,
    toggleReducedMotion,
    onVisualCue,
  } = useVisualizer();

  const [isLiked, setIsLiked] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [currentBar, setCurrentBar] = useState(1);
  const [activeTransient, setActiveTransient] = useState<'kick' | 'snare' | null>(null);
  const [scrubberWidth, setScrubberWidth] = useState(300);

  // Load active track cleanly in paused state if needed and only when track is Ready to Play
  useEffect(() => {
    if (!isTrackPlayable(activeTrack.analysisStatus)) return;
    if (isIdle || (loadedTrackId !== activeTrack.id && !isPlaying)) {
      loadTrack(activeTrack, playback).catch((e) =>
        console.warn('Player auto-load notice:', e)
      );
    }
  }, [isIdle, isPlaying, loadedTrackId, loadTrack, activeTrack]);

  // Synchronize live visual transients and beats with authoritative rhythm engine
  useEffect(() => {
    const unsubscribe = onVisualCue((cue) => {
      const payload = cue.event?.payload;
      if (payload?.beat) {
        setCurrentBeat(Math.floor(payload.beat));
      }
      if (payload?.bar) {
        setCurrentBar(payload.bar);
      }
      if (payload?.role === 'downbeat') {
        setActiveTransient('kick');
        setTimeout(() => setActiveTransient(null), 220);
      } else if (payload?.role === 'backbeat') {
        setActiveTransient('snare');
        setTimeout(() => setActiveTransient(null), 220);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onVisualCue]);

  const handlePlayPause = async () => {
    if (!isTrackPlayable(activeTrack.analysisStatus)) {
      Alert.alert(
        'Track Not Ready',
        `"${activeTrack.title}" is currently ${activeTrack.analysisStatus}. Please wait until analysis is Ready to Play.`
      );
      return;
    }
    if (isPlaying) {
      await pause();
    } else {
      await playTrack(activeTrack, playback);
    }
  };

  const handleScrubberPress = (e: any) => {
    const locX = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, locX / (scrubberWidth || 300)));
    const targetMs = ratio * (durationMs || activeTrack.durationMs || 12000);
    seek(targetMs);
  };

  const effectiveDuration = durationMs || activeTrack.durationMs || 12000;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (positionMs / effectiveDuration) * 100)) : 0;
  const isSpheres = activeTrack.id === BUNDLED_SPHERES_TRACK.id;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          accessibilityLabel="Minimize player"
          accessibilityRole="button"
        >
          <Text style={[styles.headerIconText, { color: colors.text.primary }]}>⌵</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
            {activeTrack.isLocalImport ? 'PLAYING FROM LOCAL STORAGE' : 'PLAYING FROM ALBUM'}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]} numberOfLines={1}>
            {activeTrack.album || (activeTrack.isLocalImport ? 'Device Music' : 'Spheres')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {}}
          accessibilityLabel="Track options"
          accessibilityRole="button"
        >
          <Text style={[styles.headerIconText, { color: colors.text.primary }]}>•••</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Large, Dominant Album / Audio Artwork */}
        <View style={styles.artworkSection}>
          <View style={[styles.artworkFrame, { borderColor: colors.border.subtle, backgroundColor: colors.background.secondary }]}>
            {isSpheres ? (
              <Image
                source={spheresArtwork}
                style={styles.artworkImg}
                resizeMode="cover"
                accessibilityLabel="Spheres by Halina Rice album cover"
              />
            ) : (
              <View style={[styles.customArtworkCenter, { backgroundColor: colors.background.elevated }]}>
                <Text style={styles.customArtworkIcon}>🎧</Text>
                <Text style={[styles.customArtworkMime, { color: colors.accent.secondary }]}>
                  {activeTrack.mimeType?.toUpperCase() || 'AUDIO'}
                </Text>
              </View>
            )}

            <View style={styles.bpmBadge}>
              <View
                style={[
                  styles.pulseDot,
                  {
                    backgroundColor: isTrackPlayable(activeTrack.analysisStatus)
                      ? colors.accent.secondary
                      : activeTrack.analysisStatus === 'failed'
                      ? '#EB5757'
                      : '#EB943B',
                  },
                ]}
              />
              <Text style={styles.bpmBadgeText}>
                {activeTrack.bpm
                  ? `${activeTrack.bpm} BPM`
                  : isTrackPlayable(activeTrack.analysisStatus)
                  ? 'Ready to Play'
                  : activeTrack.analysisStatus === 'failed'
                  ? 'Analysis Incomplete'
                  : 'Analyzing Audio...'}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Song Metadata & Favorite */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={[styles.trackName, { color: colors.text.primary }]} numberOfLines={1}>
              {activeTrack.title}
            </Text>
            <Text style={[styles.trackArtist, { color: colors.text.secondary }]} numberOfLines={1}>
              {activeTrack.artist} • {activeTrack.isLocalImport ? 'Imported Track' : '2020 Single'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.favoriteBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
            onPress={() => setIsLiked(!isLiked)}
            accessibilityLabel="Favorite track"
          >
            <Text style={styles.favoriteEmoji}>{isLiked ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Dynamic Tactile Sync Status Card */}
        <Card variant="surface" radius="large" style={styles.syncStatusCard}>
          <View style={styles.syncStatusHeader}>
            <View
              style={[
                styles.syncIconBox,
                {
                  backgroundColor: isTrackPlayable(activeTrack.analysisStatus)
                    ? 'rgba(21, 158, 152, 0.15)'
                    : activeTrack.analysisStatus === 'failed'
                    ? 'rgba(235, 87, 87, 0.15)'
                    : 'rgba(70, 87, 213, 0.15)',
                },
              ]}
            >
              <Text style={{ fontSize: 16 }}>
                {isTrackPlayable(activeTrack.analysisStatus)
                  ? '⚡'
                  : activeTrack.analysisStatus === 'failed'
                  ? '⚠️'
                  : '⏳'}
              </Text>
            </View>
            <View style={styles.syncStatusTextCol}>
              <Text style={[styles.syncStatusTitle, { color: colors.text.primary }]}>
                {isTrackPlayable(activeTrack.analysisStatus)
                  ? `Tactile Rhythm Sync: ${activeTrack.bpm ? `${activeTrack.bpm} BPM` : 'Ready'}`
                  : activeTrack.analysisStatus === 'failed'
                  ? 'Analysis Incomplete (Tap Retry on Home)'
                  : 'Acoustic Signal Processing in Progress...'}
              </Text>
              <Text style={[styles.syncStatusNote, { color: colors.text.secondary }]}>
                {activeTrack.summaryNote ||
                  (isTrackPlayable(activeTrack.analysisStatus)
                    ? 'High-confidence beat grid aligned with downbeats and backbeats.'
                    : 'Full-track acoustic processing and sensory timeline generation.')}
              </Text>
            </View>
          </View>

          {activeTrack.rhythmicChanges && activeTrack.rhythmicChanges.length > 0 && (
            <View style={styles.sectionChipsRow}>
              {activeTrack.rhythmicChanges.map((change, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.sectionChip,
                    { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle },
                  ]}
                >
                  <Text style={[styles.sectionChipText, { color: colors.accent.secondary }]}>
                    🏷️ {change}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* 4. Scrubber & Timestamps */}
        <View style={styles.scrubberSection}>
          <TouchableOpacity
            style={[styles.scrubberTrack, { backgroundColor: colors.background.secondary }]}
            activeOpacity={0.9}
            onLayout={(e) => setScrubberWidth(e.nativeEvent.layout.width)}
            onPress={handleScrubberPress}
          >
            <View
              style={[styles.scrubberFill, { width: `${progressPercent}%`, backgroundColor: colors.accent.primary }]}
            />
            <View
              style={[
                styles.scrubberThumb,
                {
                  left: `${progressPercent}%`,
                  backgroundColor: colors.accent.primary,
                  borderColor: colors.background.base,
                },
              ]}
            />
          </TouchableOpacity>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: colors.text.secondary }]}>
              {formatMilliseconds(positionMs)}
            </Text>
            <Text style={[styles.timeText, { color: colors.text.secondary }]}>
              {formatMilliseconds(effectiveDuration)}
            </Text>
          </View>
        </View>

        {/* 5. Main Playback Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} accessibilityLabel="Shuffle">
            <Text style={[styles.controlIconSecondary, { color: colors.text.secondary }]}>🔀</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => seek(0)}
            accessibilityLabel="Previous track"
          >
            <Text style={[styles.controlIconPrimary, { color: colors.text.primary }]}>⏮</Text>
          </TouchableOpacity>

          {/* Prominent Play / Pause */}
          <TouchableOpacity
            style={[
              styles.mainPlayBtn,
              {
                backgroundColor: isTrackPlayable(activeTrack.analysisStatus)
                  ? colors.accent.primary
                  : colors.background.elevated,
                opacity: isTrackPlayable(activeTrack.analysisStatus) ? 1 : 0.6,
              },
            ]}
            onPress={handlePlayPause}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            disabled={!isTrackPlayable(activeTrack.analysisStatus)}
          >
            <Text style={styles.mainPlayIcon}>
              {isPlaying ? '⏸' : isTrackPlayable(activeTrack.analysisStatus) ? '▶' : '⏳'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => seek((positionMs + 3000) % effectiveDuration)}
            accessibilityLabel="Next track"
          >
            <Text style={[styles.controlIconPrimary, { color: colors.text.primary }]}>⏭</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} accessibilityLabel="Repeat">
            <Text style={[styles.controlIconSecondary, { color: colors.accent.primary }]}>🔁</Text>
          </TouchableOpacity>
        </View>

        {/* 6. SEE — Visual Rhythm Preview Card */}
        <Card variant="surface" radius="large" style={styles.featureCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.featureIconBox, { backgroundColor: 'rgba(70, 87, 213, 0.12)' }]}>
                <Text style={[styles.featureEmoji, { color: colors.accent.primary }]}>👁️</Text>
              </View>
              <Text style={[styles.featureCardTitle, { color: colors.text.primary }]}>
                SEE — Visual Rhythm
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.pillBadge,
                { backgroundColor: !reducedMotion && visualEnabled ? 'rgba(21, 158, 152, 0.15)' : 'rgba(104, 113, 132, 0.15)' },
              ]}
              onPress={toggleReducedMotion}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: !reducedMotion && visualEnabled ? colors.accent.secondary : colors.text.secondary },
                ]}
              />
              <Text
                style={[
                  styles.pillText,
                  { color: !reducedMotion && visualEnabled ? colors.accent.secondary : colors.text.secondary },
                ]}
              >
                {reducedMotion ? 'Reduced' : visualEnabled ? 'Motion ON' : 'SEE OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Animated Waveform / Frequency Preview Surface */}
          <View style={[styles.previewCanvas, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}>
            <View style={styles.previewCanvasHeader}>
              <Text style={[styles.canvasMetaText, { color: colors.text.secondary }]}>
                {`Bar ${currentBar} • 4/4 • ${activeTrack.bpm ? `${activeTrack.bpm} BPM` : 'Adaptive'}`}
              </Text>
              <View style={styles.transientPillRow}>
                <Text
                  style={[
                    styles.transientPill,
                    {
                      backgroundColor: activeTransient === 'kick' ? colors.accent.primary : colors.background.secondary,
                      color: activeTransient === 'kick' ? '#FFFFFF' : colors.text.secondary,
                      fontWeight: activeTransient === 'kick' ? '800' : '600',
                    },
                  ]}
                >
                  Kick ●
                </Text>
                <Text
                  style={[
                    styles.transientPill,
                    {
                      backgroundColor: activeTransient === 'snare' ? colors.accent.secondary : colors.background.secondary,
                      color: activeTransient === 'snare' ? '#FFFFFF' : colors.text.secondary,
                      fontWeight: activeTransient === 'snare' ? '800' : '600',
                    },
                  ]}
                >
                  Snare ●
                </Text>
              </View>
            </View>

            {/* Concentric rings preview */}
            <View style={styles.ringsCenter}>
              <View
                style={[
                  styles.ring3,
                  {
                    borderColor: activeTransient === 'snare' ? colors.accent.secondary : colors.border.subtle,
                    transform: [{ scale: activeTransient === 'snare' && !reducedMotion ? 1.08 : 1 }],
                  },
                ]}
              />
              <View
                style={[
                  styles.ring2,
                  {
                    borderColor: activeTransient === 'kick' ? colors.accent.primary : colors.border.subtle,
                    transform: [{ scale: activeTransient === 'kick' && !reducedMotion ? 1.12 : 1 }],
                  },
                ]}
              />
              <View
                style={[
                  styles.ring1,
                  {
                    backgroundColor: activeTransient === 'kick' ? colors.accent.primary : colors.background.elevated,
                    transform: [{ scale: activeTransient === 'kick' && !reducedMotion ? 1.2 : 1 }],
                  },
                ]}
              />
            </View>
          </View>

          {/* 4-Beat Rhythmic Indicator */}
          <View style={styles.beatDock}>
            {[1, 2, 3, 4].map((beat) => {
              const isActive = currentBeat === beat && isPlaying;
              return (
                <View
                  key={beat}
                  style={[
                    styles.beatPill,
                    {
                      backgroundColor: isActive ? colors.accent.primary : colors.background.secondary,
                      borderColor: isActive ? colors.accent.secondary : colors.border.subtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.beatText,
                      { color: isActive ? '#FFFFFF' : colors.text.secondary },
                    ]}
                  >
                    BEAT {beat}
                  </Text>
                  <View
                    style={[
                      styles.beatDot,
                      {
                        backgroundColor: isActive ? colors.accent.secondary : colors.border.medium,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>

          <Button
            label="Enter Immersive Experience ↗"
            onPress={() => router.push('/player/immersive')}
            variant="primary"
            style={styles.immersiveEnterBtn}
          />
        </Card>

        {/* 7. FEEL — Tactile Haptics Control Card */}
        <Card variant="surface" radius="large" style={styles.featureCard}>
          <View style={styles.hapticRow}>
            <View style={styles.hapticLeft}>
              <View style={[styles.featureIconBox, { backgroundColor: 'rgba(21, 158, 152, 0.12)' }]}>
                <Text style={[styles.featureEmoji, { color: colors.accent.secondary }]}>📳</Text>
              </View>
              <View style={styles.hapticTextCol}>
                <View style={styles.hapticTitleRow}>
                  <Text style={[styles.featureCardTitle, { color: colors.text.primary }]}>
                    FEEL — Tactile Haptics
                  </Text>
                  <View style={[styles.hapticStatusPill, { backgroundColor: hapticsEnabled ? 'rgba(21, 158, 152, 0.15)' : 'rgba(104, 113, 132, 0.15)' }]}>
                    <Text style={[styles.hapticStatusText, { color: hapticsEnabled ? colors.accent.secondary : colors.text.secondary }]}>
                      {hapticsEnabled ? 'ACTIVE' : 'MUTED'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.hapticSub, { color: colors.text.secondary }]}>
                  {hapticsEnabled
                    ? 'Tactile pulses firing on Kick (downbeats) & Snare (backbeats)'
                    : 'Tactile actuation paused. Tap toggle to activate phone motor'}
                </Text>
              </View>
            </View>

            {/* Smooth Switch */}
            <TouchableOpacity
              style={[
                styles.toggleSwitch,
                { backgroundColor: hapticsEnabled ? colors.accent.secondary : colors.background.elevated },
              ]}
              onPress={toggleHaptics}
              accessibilityRole="switch"
              accessibilityLabel="Toggle Tactile Haptics"
            >
              <View
                style={[
                  styles.toggleThumb,
                  hapticsEnabled ? styles.toggleThumbActive : styles.toggleThumbInactive,
                  { backgroundColor: '#FFFFFF' },
                ]}
              />
            </TouchableOpacity>
          </View>

          {/* Test Haptic Button */}
          {hapticsEnabled && (
            <TouchableOpacity
              style={[styles.testHapticBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
              onPress={() => triggerTest('heavy')}
            >
              <Text style={[styles.testHapticText, { color: colors.accent.secondary }]}>
                ⚡ Test Haptic Kick Pulse
              </Text>
            </TouchableOpacity>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerTitleCol: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  artworkSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 18,
  },
  artworkFrame: {
    width: '100%',
    maxWidth: 340,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  artworkImg: {
    width: '100%',
    height: '100%',
  },
  customArtworkCenter: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customArtworkIcon: {
    fontSize: 72,
  },
  customArtworkMime: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 10,
  },
  bpmBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 14, 26, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bpmBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metaCol: {
    flex: 1,
    marginRight: 12,
  },
  trackName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  trackArtist: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
  favoriteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteEmoji: {
    fontSize: 18,
  },
  syncStatusCard: {
    padding: 14,
    marginBottom: 16,
  },
  syncStatusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  syncIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncStatusTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  syncStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  syncStatusNote: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  sectionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  sectionChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  scrubberSection: {
    marginBottom: 20,
  },
  scrubberTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    position: 'relative',
    overflow: 'visible',
    justifyContent: 'center',
  },
  scrubberFill: {
    height: '100%',
    borderRadius: 4,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginLeft: -8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  controlBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIconSecondary: {
    fontSize: 20,
  },
  controlIconPrimary: {
    fontSize: 28,
  },
  mainPlayBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#4657D5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  mainPlayIcon: {
    fontSize: 26,
    color: '#FFFFFF',
  },
  featureCard: {
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: {
    fontSize: 16,
  },
  featureCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  previewCanvas: {
    width: '100%',
    height: 110,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewCanvasHeader: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  canvasMetaText: {
    fontSize: 10,
    fontWeight: '600',
  },
  transientPillRow: {
    flexDirection: 'row',
    gap: 4,
  },
  transientPill: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ringsCenter: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring3: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    opacity: 0.25,
  },
  ring2: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    opacity: 0.5,
  },
  ring1: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  beatDock: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  beatPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beatText: {
    fontSize: 10,
    fontWeight: '700',
  },
  beatDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  immersiveEnterBtn: {
    minHeight: 46,
  },
  hapticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hapticLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  hapticTextCol: {
    flex: 1,
  },
  hapticTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hapticStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hapticStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  hapticSub: {
    fontSize: 12,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleThumbInactive: {
    alignSelf: 'flex-start',
  },
  testHapticBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testHapticText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
