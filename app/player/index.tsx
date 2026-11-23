import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme';
import { Card, Button } from '@/components/common';
import { usePlayback } from '@/features/playback';
import { useHaptics } from '@/features/haptics';
import { useVisualizer } from '@/features/visualizer';
import { formatMilliseconds } from '@/utils';
import { eventScheduler } from '@/engines/event-scheduler';
import { scheduleDemoTrackSensoryCues } from '@/features/rhythm';
import { hapticEngine } from '@/engines/haptic';
import { lyricsEngine } from '@/engines/lyrics';
import { DEMO_TRACK_LYRICS } from '@/features/lyrics';

const spheresArtwork = require('../../assets/images/player/spheres-album-art.png');
const DEMO_AUDIO_ASSET = require('../../assets/music/vibebridge_demo.wav');

export default function StandardMusicPlayerScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
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
  } = usePlayback();

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

  // Auto-load demo track and register sensory cues provider
  useEffect(() => {
    eventScheduler.setScoreProvider((scheduler, rev) => {
      hapticEngine.reset();
      scheduleDemoTrackSensoryCues(scheduler, rev);
    });

    if (timelineRevision > 0) {
      hapticEngine.reset();
      scheduleDemoTrackSensoryCues(eventScheduler, timelineRevision);
    }

    if (isIdle) {
      lyricsEngine.loadLyrics(DEMO_TRACK_LYRICS);
      load({
        type: 'bundle',
        assetId: DEMO_AUDIO_ASSET,
        name: 'Spheres',
        durationMs: 12000,
      }).catch((e) => console.warn('Player auto-load notice:', e));
    }

    return () => {
      eventScheduler.setScoreProvider(null);
    };
  }, [isIdle, load, timelineRevision]);

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
    if (isPlaying) {
      await pause();
    } else {
      if (isIdle) {
        lyricsEngine.loadLyrics(DEMO_TRACK_LYRICS);
        await load({
          type: 'bundle',
          assetId: DEMO_AUDIO_ASSET,
          name: 'Spheres',
          durationMs: 12000,
        });
      }
      if (isPaused || isStopped) {
        if (isStopped && durationMs > 0 && positionMs >= durationMs) {
          await seek(0);
        }
        await resume();
      } else {
        await play();
      }
    }
  };

  const handleScrubberPress = (e: any) => {
    const locX = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, locX / (scrubberWidth || 300)));
    const targetMs = ratio * (durationMs || 12000);
    seek(targetMs);
  };

  const progressPercent = durationMs > 0 ? Math.min(100, Math.max(0, (positionMs / durationMs) * 100)) : 0;

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
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>PLAYING FROM ALBUM</Text>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Spheres</Text>
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
        {/* 1. Large, Dominant Album Artwork */}
        <View style={styles.artworkSection}>
          <View style={[styles.artworkFrame, { borderColor: colors.border.subtle, backgroundColor: colors.background.secondary }]}>
            <Image
              source={spheresArtwork}
              style={styles.artworkImg}
              resizeMode="cover"
              accessibilityLabel="Spheres by Halina Rice album cover"
            />
            <View style={styles.bpmBadge}>
              <View style={[styles.pulseDot, { backgroundColor: colors.accent.secondary }]} />
              <Text style={styles.bpmBadgeText}>120 BPM</Text>
            </View>
          </View>
        </View>

        {/* 2. Song Metadata & Favorite */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={[styles.trackName, { color: colors.text.primary }]}>Spheres</Text>
            <Text style={[styles.trackArtist, { color: colors.text.secondary }]}>Halina Rice • 2020 Single</Text>
          </View>
          <TouchableOpacity
            style={[styles.favoriteBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
            onPress={() => setIsLiked(!isLiked)}
            accessibilityLabel="Favorite track"
          >
            <Text style={styles.favoriteEmoji}>{isLiked ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Scrubber & Timestamps */}
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
              {formatMilliseconds(durationMs || 12000)}
            </Text>
          </View>
        </View>

        {/* 4. Main Playback Controls */}
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
            style={[styles.mainPlayBtn, { backgroundColor: colors.accent.primary }]}
            onPress={handlePlayPause}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Text style={styles.mainPlayIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => seek((positionMs + 3000) % (durationMs || 12000))}
            accessibilityLabel="Next track"
          >
            <Text style={[styles.controlIconPrimary, { color: colors.text.primary }]}>⏭</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} accessibilityLabel="Repeat">
            <Text style={[styles.controlIconSecondary, { color: colors.accent.primary }]}>🔁</Text>
          </TouchableOpacity>
        </View>

        {/* 5. SEE — Visual Rhythm Preview Card */}
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
                {`Bar ${currentBar} • 4/4 • 120 BPM`}
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

        {/* 6. FEEL — Tactile Haptics Control Card */}
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
    marginBottom: 16,
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
