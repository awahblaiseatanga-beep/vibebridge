import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme';
import { usePlayback } from '@/features/playback';
import { useVisualizer } from '@/features/visualizer';
import { useHaptics } from '@/features/haptics';
import { useLyrics } from '@/features/lyrics';
import { formatMilliseconds } from '@/utils';
import { useLocalMusicLibrary } from '@/features/library';

export default function ImmersiveExperienceScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const playback = usePlayback();
  const {
    positionMs,
    durationMs,
    isPlaying,
    pause,
    seek,
  } = playback;

  const { activeTrack, playTrack } = useLocalMusicLibrary();
  const { enabled: visualEnabled, toggleEnabled: toggleVisual, onVisualCue } = useVisualizer();
  const { enabled: hapticsEnabled, toggleEnabled: toggleHaptics, triggerTest } = useHaptics();
  const { activeSegment, previousSegment, upcomingSegments } = useLyrics();

  const [currentBeat, setCurrentBeat] = useState(1);
  const [currentBar, setCurrentBar] = useState(1);
  const [kickActive, setKickActive] = useState(false);
  const [snareActive, setSnareActive] = useState(false);

  // Animated kinetic rings
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;

  // Reset visual ring state when paused or stopped
  useEffect(() => {
    if (!isPlaying) {
      setKickActive(false);
      setSnareActive(false);
      pulseAnim1.setValue(1);
      pulseAnim2.setValue(1);
    }
  }, [isPlaying, pulseAnim1, pulseAnim2]);

  // Synchronize kinetic rings & HUD strictly to authoritative SEE cues from PriorityEventScheduler
  useEffect(() => {
    const unsubscribe = onVisualCue((cue) => {
      const payload = cue.event?.payload;
      if (payload?.beat) {
        setCurrentBeat(Math.floor(payload.beat));
      }
      if (payload?.bar) {
        setCurrentBar(payload.bar);
      }

      const isStrong =
        payload?.role === 'downbeat' ||
        payload?.role === 'accent' ||
        payload?.role === 'resolution';

      if (isStrong) {
        setKickActive(true);
        setTimeout(() => setKickActive(false), 160);
        Animated.sequence([
          Animated.timing(pulseAnim2, {
            toValue: 1.18,
            duration: 90,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim2, {
            toValue: 1,
            duration: 180,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        setSnareActive(true);
        setTimeout(() => setSnareActive(false), 140);
        Animated.sequence([
          Animated.timing(pulseAnim1, {
            toValue: 1.14,
            duration: 80,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim1, {
            toValue: 1,
            duration: 160,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onVisualCue, pulseAnim1, pulseAnim2]);

  const handlePlayPause = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await playTrack(activeTrack, playback);
    }
  };

  const effectiveDuration = durationMs || activeTrack.durationMs || 12000;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (positionMs / effectiveDuration) * 100)) : 0;

  // Fallback lyric lines if demo track lyrics are streaming
  const activeLyricText = activeSegment ? activeSegment.text : 'Resonating spheres in the quiet glow';
  const previousLyricText = previousSegment ? previousSegment.text : 'Echoes drifting through the static';
  const upcomingLyricText =
    upcomingSegments && upcomingSegments.length > 0
      ? upcomingSegments[0].text
      : 'Feeling every frequency align';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      {/* 1. Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.minimizeBtn}
            onPress={() => router.back()}
            accessibilityLabel="Minimize immersive experience"
            accessibilityRole="button"
          >
            <Text style={[styles.minimizeIcon, { color: colors.text.primary }]}>⌵</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.headerTrackName, { color: colors.text.primary }]} numberOfLines={1}>
                {activeTrack.title} • {activeTrack.artist}
              </Text>
              <View style={[styles.immersiveBadge, { backgroundColor: colors.accent.primary }]}>
                <Text style={styles.immersiveBadgeText}>IMMERSIVE</Text>
              </View>
            </View>
            {/* Direct SEE & FEEL Status Badges */}
            <View style={styles.headerPillsRow}>
              <TouchableOpacity
                style={[
                  styles.headerPill,
                  { backgroundColor: visualEnabled ? 'rgba(70, 87, 213, 0.15)' : colors.background.elevated },
                ]}
                onPress={toggleVisual}
                accessibilityRole="switch"
              >
                <Text style={[styles.headerPillText, { color: visualEnabled ? colors.accent.primary : colors.text.secondary }]}>
                  {visualEnabled ? '👁️ SEE ON' : '👁️ SEE OFF'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerPill,
                  { backgroundColor: hapticsEnabled ? 'rgba(21, 158, 152, 0.15)' : colors.background.elevated },
                ]}
                onPress={toggleHaptics}
                accessibilityRole="switch"
              >
                <Text style={[styles.headerPillText, { color: hapticsEnabled ? colors.accent.secondary : colors.text.secondary }]}>
                  {hapticsEnabled ? '📳 FEEL ON' : '📳 FEEL OFF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. HUD Rhythmic Meta Row */}
        <View style={styles.hudRow}>
          {/* Kick Trigger Pill */}
          <View
            style={[
              styles.hudTriggerPill,
              {
                backgroundColor: kickActive ? colors.accent.primary : colors.background.elevated,
                borderColor: kickActive ? colors.accent.secondary : colors.border.subtle,
              },
            ]}
          >
            <View style={[styles.pulseDot, { backgroundColor: kickActive ? '#FFFFFF' : colors.accent.primary }]} />
            <Text style={[styles.hudTriggerText, { color: kickActive ? '#FFFFFF' : colors.text.primary }]}>
              KICK ACTIVE
            </Text>
          </View>

          {/* Meter & Tempo HUD */}
          <View style={[styles.hudMeterPill, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
            <Text style={[styles.hudMeterText, { color: colors.text.primary }]}>
              {`BAR ${currentBar} • 4/4 • ${activeTrack.bpm ? `${activeTrack.bpm} BPM` : 'Adaptive'}`}
            </Text>
          </View>

          {/* Snare Trigger Pill */}
          <View
            style={[
              styles.hudTriggerPill,
              {
                backgroundColor: snareActive ? colors.accent.secondary : colors.background.elevated,
                borderColor: snareActive ? colors.accent.primary : colors.border.subtle,
              },
            ]}
          >
            <View style={[styles.pulseDot, { backgroundColor: snareActive ? '#FFFFFF' : colors.accent.secondary }]} />
            <Text style={[styles.hudTriggerText, { color: snareActive ? '#FFFFFF' : colors.text.primary }]}>
              SNARE SUB
            </Text>
          </View>
        </View>

        {/* 3. Main Concentric Kinetic Visualizer Canvas */}
        <View style={[styles.kineticCanvasBox, { backgroundColor: colors.background.surface, borderColor: colors.border.subtle }]}>
          {/* Subtle Ambient Glow */}
          <View
            style={[
              styles.ambientGlow,
              { backgroundColor: isDark ? 'rgba(70, 87, 213, 0.15)' : 'rgba(70, 87, 213, 0.08)' },
            ]}
          />

          {/* 4-Beat Rhythmic Indicator Dock */}
          <View style={styles.beatDockAbsolute}>
            {[1, 2, 3, 4].map((beat) => {
              const isActive = currentBeat === beat && isPlaying;
              return (
                <View
                  key={beat}
                  style={[
                    styles.beatPillMini,
                    {
                      backgroundColor: isActive ? colors.accent.primary : 'rgba(255, 255, 255, 0.12)',
                      borderColor: isActive ? colors.accent.secondary : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.beatPillText, { color: isActive ? '#FFFFFF' : colors.text.secondary }]}>
                    B{beat}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Outer Guidance Circle */}
          <View style={[styles.outerRing, { borderColor: colors.border.subtle }]} />

          {/* Animated Harmonic Outer Ring */}
          <Animated.View
            style={[
              styles.harmonicRing,
              {
                borderColor: colors.accent.secondary,
                transform: [{ scale: pulseAnim1 }],
              },
            ]}
          />

          {/* Expanding Sub-Bass Resonance Ring */}
          <Animated.View
            style={[
              styles.subBassRing,
              {
                borderColor: colors.accent.primary,
                transform: [{ scale: pulseAnim2 }],
              },
            ]}
          />

          {/* Inner High-Tension Ring */}
          <View style={[styles.innerRing, { borderColor: colors.accent.primary }]} />

          {/* Central Kinetic Core Unit */}
          <View
            style={[
              styles.centralCoreUnit,
              {
                backgroundColor: colors.background.elevated,
                borderColor: colors.border.subtle,
              },
            ]}
          >
            <View style={[styles.coreIconBox, { backgroundColor: colors.accent.primary }]}>
              <Text style={styles.coreIconText}>⚡</Text>
            </View>
            <Text style={[styles.coreTitle, { color: colors.text.primary }]} numberOfLines={1}>
              {activeTrack.title}
            </Text>
            <Text style={[styles.coreSub, { color: colors.accent.secondary }]}>
              {activeTrack.bpm ? `${activeTrack.bpm} BPM Pulse` : 'Adaptive Pulse'}
            </Text>
          </View>

          {/* 4. FLOATING TRANSLUCENT SYNCHRONIZED LYRICS OR ACOUSTIC VISUALIZER OVERLAY */}
          <View
            style={[
              styles.floatingLyricsCard,
              {
                backgroundColor: isDark ? 'rgba(25, 34, 49, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                borderColor: colors.border.subtle,
              },
            ]}
          >
            {activeTrack.hasLyrics ? (
              <>
                {/* Lyrics Header */}
                <View style={styles.lyricsCardHeader}>
                  <View style={styles.lyricsHeaderLeft}>
                    <Text style={[styles.lyricsWaveIcon, { color: colors.accent.secondary }]}>〰️</Text>
                    <Text style={[styles.lyricsHeaderTitle, { color: colors.accent.secondary }]}>
                      SYNCHRONIZED LYRICS
                    </Text>
                  </View>
                  <View style={styles.lyricsHeaderRight}>
                    <Text style={[styles.lyricsActiveCount, { color: colors.text.secondary }]}>
                      Live In-Sync
                    </Text>
                  </View>
                </View>

                {/* 3-Tier Lyric Hierarchy */}
                <View style={styles.lyricsTierContainer}>
                  <Text style={[styles.lyricLineDimmed, { color: colors.text.secondary }]} numberOfLines={1}>
                    {previousLyricText}
                  </Text>
                  <View style={[styles.lyricActiveRow, { backgroundColor: isDark ? 'rgba(32, 43, 59, 0.7)' : 'rgba(231, 234, 241, 0.7)' }]}>
                    <View style={[styles.activeAccentBar, { backgroundColor: colors.accent.primary }]} />
                    <Text style={[styles.lyricLineActive, { color: colors.text.primary }]} numberOfLines={1}>
                      {activeLyricText}
                    </Text>
                  </View>
                  <Text style={[styles.lyricLineDimmed, { color: colors.text.secondary }]} numberOfLines={1}>
                    {upcomingLyricText}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {/* Acoustic Signal Processing View for Imported Audio */}
                <View style={styles.lyricsCardHeader}>
                  <View style={styles.lyricsHeaderLeft}>
                    <Text style={[styles.lyricsWaveIcon, { color: colors.accent.secondary }]}>〰️</Text>
                    <Text style={[styles.lyricsHeaderTitle, { color: colors.accent.secondary }]}>
                      ACOUSTIC SIGNAL VISUALIZER
                    </Text>
                  </View>
                  <View style={styles.lyricsHeaderRight}>
                    <Text style={[styles.lyricsActiveCount, { color: colors.accent.secondary }]}>
                      {activeTrack.bpm ? `${activeTrack.bpm} BPM Sync` : 'Adaptive Transient Sync'}
                    </Text>
                  </View>
                </View>

                <View style={styles.lyricsTierContainer}>
                  <Text style={[styles.lyricLineDimmed, { color: colors.text.secondary }]}>
                    Audio Signal Processing: {activeTrack.mimeType?.toUpperCase() || 'PCM Audio'}
                  </Text>
                  <View style={[styles.lyricActiveRow, { backgroundColor: isDark ? 'rgba(32, 43, 59, 0.7)' : 'rgba(231, 234, 241, 0.7)' }]}>
                    <View style={[styles.activeAccentBar, { backgroundColor: colors.accent.primary }]} />
                    <Text style={[styles.lyricLineActive, { color: colors.text.primary }]} numberOfLines={1}>
                      {activeTrack.summaryNote || 'Live sensory cues generated from transient acoustic attacks'}
                    </Text>
                  </View>
                  <Text style={[styles.lyricLineDimmed, { color: colors.text.secondary }]}>
                    {activeTrack.rhythmScore ? `${activeTrack.rhythmScore.length} sensory cues active` : 'Kinetic visual pulses active'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 5. Bottom Playback & Haptic Transport Dock */}
        <View style={styles.transportDock}>
          {/* Scrubbing Bar & Timestamps */}
          <TouchableOpacity
            style={[styles.scrubberContainer, { backgroundColor: colors.background.secondary }]}
            activeOpacity={0.9}
            onPress={() => seek(effectiveDuration * 0.5)}
          >
            <View style={[styles.scrubberFill, { width: `${progressPercent}%`, backgroundColor: colors.accent.primary }]} />
          </TouchableOpacity>
          <View style={styles.timeInfoRow}>
            <Text style={[styles.timeLabel, { color: colors.text.secondary }]}>
              {formatMilliseconds(positionMs)}
            </Text>
            <View style={styles.hapticSyncIndicator}>
              <Text style={[styles.hapticSyncEmoji, { color: colors.accent.secondary }]}>📳</Text>
              <Text style={[styles.hapticSyncText, { color: colors.accent.secondary }]}>
                HAPTIC IN-SYNC
              </Text>
            </View>
            <Text style={[styles.timeLabel, { color: colors.text.secondary }]}>
              {formatMilliseconds(effectiveDuration)}
            </Text>
          </View>

          {/* Tactile Mode Status Cards */}
          <View style={styles.statusCardsRow}>
            <View style={[styles.statusCard, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
              <View style={styles.statusCardLeft}>
                <View style={[styles.statusIconBox, { backgroundColor: 'rgba(70, 87, 213, 0.15)' }]}>
                  <Text style={{ fontSize: 16 }}>👁️</Text>
                </View>
                <View>
                  <Text style={[styles.statusCardTitle, { color: colors.text.primary }]}>SEE VISUAL</Text>
                  <Text style={[styles.statusCardSub, { color: colors.text.secondary }]}>Pulse wave 100%</Text>
                </View>
              </View>
              <View style={[styles.statusIndicatorDot, { backgroundColor: colors.accent.primary }]} />
            </View>

            <View style={[styles.statusCard, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
              <View style={styles.statusCardLeft}>
                <View style={[styles.statusIconBox, { backgroundColor: 'rgba(21, 158, 152, 0.15)' }]}>
                  <Text style={{ fontSize: 16 }}>📳</Text>
                </View>
                <View>
                  <Text style={[styles.statusCardTitle, { color: colors.text.primary }]}>FEEL HAPTIC</Text>
                  <Text style={[styles.statusCardSub, { color: colors.text.secondary }]}>
                    {activeTrack.bpm ? `${activeTrack.bpm} BPM` : 'Adaptive'}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusIndicatorDot, { backgroundColor: colors.accent.secondary }]} />
            </View>
          </View>

          {/* Tactile Rhythm Pad Triggers Row */}
          <View style={styles.rhythmPadsRow}>
            <TouchableOpacity
              style={[styles.rhythmPadBtn, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}
              onPress={() => triggerTest('heavy')}
              activeOpacity={0.8}
            >
              <Text style={[styles.rhythmPadSymbol, { color: colors.accent.primary }]}>●</Text>
              <Text style={[styles.rhythmPadLabel, { color: colors.text.primary }]}>BASS DRUM</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rhythmPadBtn, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}
              onPress={() => triggerTest('light')}
              activeOpacity={0.8}
            >
              <Text style={[styles.rhythmPadSymbol, { color: colors.accent.secondary }]}>▲</Text>
              <Text style={[styles.rhythmPadLabel, { color: colors.text.primary }]}>CYMBAL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rhythmPadBtn, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}
              onPress={() => triggerTest('medium')}
              activeOpacity={0.8}
            >
              <Text style={[styles.rhythmPadSymbol, { color: colors.sensory.read }]}>■</Text>
              <Text style={[styles.rhythmPadLabel, { color: colors.text.primary }]}>SNARE</Text>
            </TouchableOpacity>
          </View>

          {/* Floating Playback Bar */}
          <View style={[styles.floatingControlBar, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}>
            <TouchableOpacity
              style={styles.barIconBtn}
              onPress={toggleHaptics}
              accessibilityLabel="Tune Haptics"
            >
              <Text style={styles.barEmoji}>🎛️</Text>
            </TouchableOpacity>

            <View style={styles.barCenterGroup}>
              <TouchableOpacity
                style={styles.barIconBtn}
                onPress={() => seek(0)}
                accessibilityLabel="Previous Section"
              >
                <Text style={[styles.barCenterIcon, { color: colors.text.primary }]}>⏮</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.barPlayBtn, { backgroundColor: colors.accent.primary }]}
                onPress={handlePlayPause}
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              >
                <Text style={styles.barPlayIcon}>{isPlaying ? '⏸' : '▶'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.barIconBtn}
                onPress={() => seek(Math.min(effectiveDuration, positionMs + 3000))}
                accessibilityLabel="Next Section"
              >
                <Text style={[styles.barCenterIcon, { color: colors.text.primary }]}>⏭</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.barIconBtn}
              onPress={toggleVisual}
              accessibilityLabel="Visual Presets"
            >
              <Text style={styles.barEmoji}>📊</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  minimizeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizeIcon: {
    fontSize: 26,
    fontWeight: '700',
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTrackName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  immersiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  immersiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  headerPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  headerPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  headerPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 6,
  },
  hudTriggerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hudTriggerText: {
    fontSize: 10,
    fontWeight: '700',
  },
  hudMeterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  hudMeterText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  kineticCanvasBox: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 390,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  ambientGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  beatDockAbsolute: {
    position: 'absolute',
    top: 12,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  beatPillMini: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  beatPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  outerRing: {
    position: 'absolute',
    width: '88%',
    height: '88%',
    borderRadius: 200,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  harmonicRing: {
    position: 'absolute',
    width: '74%',
    height: '74%',
    borderRadius: 180,
    borderWidth: 2,
    opacity: 0.5,
  },
  subBassRing: {
    position: 'absolute',
    width: '60%',
    height: '60%',
    borderRadius: 150,
    borderWidth: 2.5,
    opacity: 0.7,
  },
  innerRing: {
    position: 'absolute',
    width: '46%',
    height: '46%',
    borderRadius: 110,
    borderWidth: 1.5,
    borderStyle: 'dotted',
    opacity: 0.5,
  },
  centralCoreUnit: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    elevation: 4,
  },
  coreIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  coreIconText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  coreTitle: {
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 8,
  },
  coreSub: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  floatingLyricsCard: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    zIndex: 20,
    elevation: 6,
  },
  lyricsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  lyricsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lyricsWaveIcon: {
    fontSize: 13,
  },
  lyricsHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  lyricsHeaderRight: {},
  lyricsActiveCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  lyricsTierContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  lyricLineDimmed: {
    fontSize: 11,
    opacity: 0.65,
    paddingLeft: 8,
  },
  lyricActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  activeAccentBar: {
    width: 3,
    height: 16,
    borderRadius: 1.5,
  },
  lyricLineActive: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  transportDock: {
    flexDirection: 'column',
    gap: 12,
  },
  scrubberContainer: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    borderRadius: 3,
  },
  timeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  hapticSyncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hapticSyncEmoji: {
    fontSize: 12,
  },
  hapticSyncText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCardTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusCardSub: {
    fontSize: 10,
    marginTop: 1,
  },
  statusIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rhythmPadsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rhythmPadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  rhythmPadSymbol: {
    fontSize: 12,
  },
  rhythmPadLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  floatingControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  barIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barEmoji: {
    fontSize: 18,
  },
  barCenterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barCenterIcon: {
    fontSize: 22,
  },
  barPlayBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barPlayIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
});
