import React, { useEffect } from 'react';
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
import { eventScheduler } from '@/engines/event-scheduler';
import { scheduleDemoTrackSensoryCues } from '@/features/rhythm';
import { hapticEngine } from '@/engines/haptic';
import { lyricsEngine } from '@/engines/lyrics';
import { DEMO_TRACK_LYRICS } from '@/features/lyrics';

// Local verified artwork
const spheresArtwork = require('../assets/images/player/spheres-album-art.png');
const drumKitHero = require('../assets/images/lessons/rock-foundation-groove.jpg');
const DEMO_AUDIO_ASSET = require('../assets/music/vibebridge_demo.wav');

export default function ExploreMusicScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const {
    isPlaying,
    isIdle,
    isPaused,
    isStopped,
    timelineRevision,
    load,
    play,
    pause,
    resume,
  } = usePlayback();
  const { enabled: hapticsEnabled, toggleEnabled: toggleHaptics } = useHaptics();
  const { enabled: visualEnabled, toggleEnabled: toggleVisual } = useVisualizer();

  // Attach master score provider for synchronized sensory cues
  useEffect(() => {
    eventScheduler.setScoreProvider((scheduler, rev) => {
      hapticEngine.reset();
      scheduleDemoTrackSensoryCues(scheduler, rev);
    });

    if (timelineRevision > 0) {
      hapticEngine.reset();
      scheduleDemoTrackSensoryCues(eventScheduler, timelineRevision);
    }

    return () => {
      eventScheduler.setScoreProvider(null);
    };
  }, [timelineRevision]);

  const handleToggleSpheres = async () => {
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
        await resume();
      } else {
        await play();
      }
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header: Brand, Sensory Badge & System Controls */}
        <View style={[styles.headerContainer, { borderBottomColor: colors.border.subtle }]}>
          <View style={styles.brandRow}>
            <View style={[styles.brandIconBox, { backgroundColor: colors.accent.primary }]}>
              <Text style={styles.brandIconText}>⚡</Text>
            </View>
            <View style={styles.brandTextCol}>
              <Text style={[styles.brandSuperTitle, { color: colors.accent.primary }]}>VIBEBRIDGE</Text>
              <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Explore Music</Text>
              <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
                Feel & see music through tactile resonance
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.actionCircleButton, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}
              onPress={toggleTheme}
              accessibilityLabel="Toggle Light / Dark theme"
              accessibilityRole="button"
            >
              <Text style={styles.actionIcon}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionCircleButton, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}
              onPress={() => router.push('/settings')}
              accessibilityLabel="Open Settings"
              accessibilityRole="button"
            >
              <Text style={styles.actionIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Dominant Featured Music Artwork Card */}
        <Card variant="surface" radius="hero" style={styles.musicHeroCard}>
          <View style={[styles.artworkContainer, { backgroundColor: colors.background.secondary }]}>
            <Image
              source={spheresArtwork}
              style={styles.artworkImage}
              resizeMode="cover"
              accessibilityLabel="Spheres by Halina Rice Album Art"
            />
            {/* Live BPM Badge */}
            <View style={styles.bpmBadgeContainer}>
              <View style={[styles.bpmBadge, { backgroundColor: 'rgba(10, 14, 26, 0.85)' }]}>
                <View style={[styles.pulseDot, { backgroundColor: colors.accent.secondary }]} />
                <Text style={styles.bpmBadgeText}>120 BPM • 4/4</Text>
              </View>
            </View>
          </View>

          <View style={styles.trackDetailsContainer}>
            <View style={styles.trackMetaRow}>
              <View style={styles.trackTitleCol}>
                <Text style={[styles.trackTitle, { color: colors.text.primary }]}>
                  Spheres
                </Text>
                <Text style={[styles.trackArtist, { color: colors.text.secondary }]}>
                  Halina Rice • Electronic / Downtempo
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.favoriteBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
                accessibilityLabel="Favorite track"
              >
                <Text style={styles.favoriteIcon}>❤️</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.trackDescription, { color: colors.text.secondary }]}>
              Immerse yourself in synchronized visual rhythms, real-time kinetic wave motion, and calibrated tactile phone haptics.
            </Text>

            {/* Primary Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <Button
                label={isPlaying ? 'Pause Player' : 'Open Music Player'}
                onPress={() => router.push('/player' as any)}
                variant="primary"
                style={styles.mainPlayerBtn}
              />
              <Button
                label="Immersive Mode"
                onPress={() => router.push('/player/immersive' as any)}
                variant="secondary"
                style={styles.immersiveBtn}
              />
            </View>
          </View>
        </Card>

        {/* 3. Sensory Controls & Real-Time Indicators */}
        <View style={styles.sensoryRow}>
          {/* SEE Visual Rhythm */}
          <Card variant="surface" radius="large" style={styles.sensoryCard}>
            <View style={styles.sensoryHeader}>
              <View style={[styles.sensoryIconBox, { backgroundColor: 'rgba(70, 87, 213, 0.12)' }]}>
                <Text style={[styles.sensoryIcon, { color: colors.accent.primary }]}>👁️</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: visualEnabled ? 'rgba(21, 158, 152, 0.15)' : 'rgba(104, 113, 132, 0.15)' }]}>
                <View style={[styles.smallDot, { backgroundColor: visualEnabled ? colors.accent.secondary : colors.text.secondary }]} />
                <Text style={[styles.statusPillText, { color: visualEnabled ? colors.accent.secondary : colors.text.secondary }]}>
                  {visualEnabled ? 'SEE ON' : 'SEE OFF'}
                </Text>
              </View>
            </View>
            <Text style={[styles.sensoryTitle, { color: colors.text.primary }]}>SEE — Visual Rhythm</Text>
            <Text style={[styles.sensorySub, { color: colors.text.secondary }]}>
              Kinetic waveform and frequency ring motion mapped to musical transients.
            </Text>
            <TouchableOpacity
              style={[styles.miniToggleBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
              onPress={toggleVisual}
            >
              <Text style={[styles.miniToggleText, { color: colors.text.primary }]}>
                {visualEnabled ? 'Disable Visual Preview' : 'Enable Visual Preview'}
              </Text>
            </TouchableOpacity>
          </Card>

          {/* FEEL Tactile Haptics */}
          <Card variant="surface" radius="large" style={styles.sensoryCard}>
            <View style={styles.sensoryHeader}>
              <View style={[styles.sensoryIconBox, { backgroundColor: 'rgba(21, 158, 152, 0.12)' }]}>
                <Text style={[styles.sensoryIcon, { color: colors.accent.secondary }]}>📳</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: hapticsEnabled ? 'rgba(21, 158, 152, 0.15)' : 'rgba(104, 113, 132, 0.15)' }]}>
                <View style={[styles.smallDot, { backgroundColor: hapticsEnabled ? colors.accent.secondary : colors.text.secondary }]} />
                <Text style={[styles.statusPillText, { color: hapticsEnabled ? colors.accent.secondary : colors.text.secondary }]}>
                  {hapticsEnabled ? 'FEEL ON' : 'FEEL OFF'}
                </Text>
              </View>
            </View>
            <Text style={[styles.sensoryTitle, { color: colors.text.primary }]}>FEEL — Tactile Haptics</Text>
            <Text style={[styles.sensorySub, { color: colors.text.secondary }]}>
              Independent phone vibration pulses synchronized with kick and snare pulses.
            </Text>
            <TouchableOpacity
              style={[styles.miniToggleBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
              onPress={toggleHaptics}
            >
              <Text style={[styles.miniToggleText, { color: colors.text.primary }]}>
                {hapticsEnabled ? 'Mute Haptic Pulses' : 'Activate Phone Haptics'}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* 4. PROMINENT ENTRY POINT: LEARN TO PLAY MUSIC */}
        <Card variant="elevated" radius="hero" style={[styles.learningGatewayCard, { borderColor: colors.accent.primary }]}>
          <View style={[styles.gatewayImageContainer, { backgroundColor: colors.background.secondary }]}>
            <Image
              source={drumKitHero}
              style={styles.gatewayImage}
              resizeMode="cover"
              accessibilityLabel="Acoustic Drum Kit Hero"
            />
            <View style={styles.gatewayOverlay} />
            <View style={styles.gatewayBadgeBox}>
              <View style={[styles.gatewayPill, { backgroundColor: colors.accent.primary }]}>
                <Text style={styles.gatewayPillText}>LEARN TO PLAY MUSIC</Text>
              </View>
            </View>
          </View>

          <View style={styles.gatewayContent}>
            <Text style={[styles.gatewayTitle, { color: colors.text.primary }]}>
              Tactile Drum Academy
            </Text>
            <Text style={[styles.gatewayBody, { color: colors.text.secondary }]}>
              Feel professionally demonstrated drum rhythms, study visual transient patterns, practise with a real acoustic drum kit, and receive instant visual performance analysis.
            </Text>

            <View style={styles.gatewayHighlights}>
              <View style={[styles.highlightTag, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
                <Text style={styles.highlightEmoji}>🥁</Text>
                <Text style={[styles.highlightText, { color: colors.text.primary }]}>Acoustic Kit Focus</Text>
              </View>
              <View style={[styles.highlightTag, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
                <Text style={styles.highlightEmoji}>📳</Text>
                <Text style={[styles.highlightText, { color: colors.text.primary }]}>Somatic Haptic Loop</Text>
              </View>
              <View style={[styles.highlightTag, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
                <Text style={styles.highlightEmoji}>🎙️</Text>
                <Text style={[styles.highlightText, { color: colors.text.primary }]}>Acoustic Mic Analysis</Text>
              </View>
            </View>

            <Button
              label="Enter Drum Academy"
              onPress={() => router.push('/learn')}
              variant="primary"
              style={styles.gatewayButton}
            />
          </View>
        </Card>

        {/* 5. Music Catalog / Available Selections */}
        <View style={styles.catalogSection}>
          <View style={styles.catalogHeader}>
            <Text style={[styles.catalogTitle, { color: colors.text.primary }]}>Available Music</Text>
            <Text style={[styles.catalogBadge, { color: colors.accent.secondary }]}>2 Experiences</Text>
          </View>

          {/* Item 1: Spheres */}
          <TouchableOpacity
            style={[styles.catalogCard, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
            onPress={handleToggleSpheres}
            activeOpacity={0.8}
          >
            <Image source={spheresArtwork} style={styles.catalogThumb} resizeMode="cover" />
            <View style={styles.catalogInfo}>
              <Text style={[styles.catalogTrackTitle, { color: colors.text.primary }]}>Spheres</Text>
              <Text style={[styles.catalogTrackArtist, { color: colors.text.secondary }]}>
                Halina Rice • 120 BPM • Synchronized Visuals & Haptics
              </Text>
            </View>
            <View style={[styles.playPill, { backgroundColor: isPlaying ? colors.accent.secondary : colors.accent.primary }]}>
              <Text style={styles.playPillText}>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
            </View>
          </TouchableOpacity>

          {/* Item 2: Live Concert Mode */}
          <TouchableOpacity
            style={[styles.catalogCard, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
            onPress={() => router.push('/player/immersive' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.catalogThumbPlaceholder, { backgroundColor: colors.background.elevated }]}>
              <Text style={styles.catalogThumbEmoji}>🎪</Text>
            </View>
            <View style={styles.catalogInfo}>
              <Text style={[styles.catalogTrackTitle, { color: colors.text.primary }]}>Live Stage Audio</Text>
              <Text style={[styles.catalogTrackArtist, { color: colors.text.secondary }]}>
                Real-time acoustic live stream analysis & tactile translation
              </Text>
            </View>
            <View style={[styles.playPill, { backgroundColor: colors.accent.secondary }]}>
              <Text style={styles.playPillText}>LIVE</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  brandIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  brandTextCol: {
    flex: 1,
  },
  brandSuperTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
  },
  musicHeroCard: {
    marginBottom: 20,
    padding: 0,
    overflow: 'hidden',
  },
  artworkContainer: {
    width: '100%',
    aspectRatio: 16 / 10,
    position: 'relative',
    overflow: 'hidden',
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  bpmBadgeContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  bpmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bpmBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  trackDetailsContainer: {
    padding: 20,
  },
  trackMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  trackTitleCol: {
    flex: 1,
    marginRight: 12,
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  trackArtist: {
    fontSize: 14,
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
  favoriteIcon: {
    fontSize: 18,
  },
  trackDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  actionButtonsRow: {
    flexDirection: 'column',
    gap: 10,
  },
  mainPlayerBtn: {
    minHeight: 52,
  },
  immersiveBtn: {
    minHeight: 48,
  },
  sensoryRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  sensoryCard: {
    padding: 16,
  },
  sensoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sensoryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensoryIcon: {
    fontSize: 18,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  smallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sensoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sensorySub: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  miniToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  miniToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  learningGatewayCard: {
    marginBottom: 24,
    padding: 0,
    borderWidth: 2,
    overflow: 'hidden',
  },
  gatewayImageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    overflow: 'hidden',
  },
  gatewayImage: {
    width: '100%',
    height: '100%',
  },
  gatewayOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 23, 34, 0.4)',
  },
  gatewayBadgeBox: {
    position: 'absolute',
    top: 14,
    left: 14,
  },
  gatewayPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  gatewayPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  gatewayContent: {
    padding: 20,
  },
  gatewayTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  gatewayBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  gatewayHighlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  highlightTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  highlightEmoji: {
    fontSize: 13,
  },
  highlightText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gatewayButton: {
    minHeight: 52,
  },
  catalogSection: {
    marginBottom: 24,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  catalogTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  catalogBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  catalogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  catalogThumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
  },
  catalogThumbPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogThumbEmoji: {
    fontSize: 24,
  },
  catalogInfo: {
    flex: 1,
  },
  catalogTrackTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  catalogTrackArtist: {
    fontSize: 12,
    marginTop: 2,
  },
  playPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  playPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
