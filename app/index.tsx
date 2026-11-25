import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme';
import { Card, Button, TrackProcessingCard } from '@/components/common';
import { usePlayback } from '@/features/playback';
import { useHaptics } from '@/features/haptics';
import { useVisualizer } from '@/features/visualizer';
import { useLocalMusicLibrary } from '@/features/library';
import { BUNDLED_SPHERES_TRACK } from '@/services/tracks';
import { TrackMetadata, isTrackPlayable } from '@/types';

// Local verified artwork
const spheresArtwork = require('../assets/images/player/spheres-album-art.png');
const drumKitHero = require('../assets/images/lessons/rock-foundation-groove.jpg');

export default function ExploreMusicScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const playback = usePlayback();
  const {
    positionMs,
    durationMs,
    isPlaying,
    isPaused,
    isStopped,
    play,
    pause,
    resume,
    seek,
  } = playback;

  const { enabled: hapticsEnabled, toggleEnabled: toggleHaptics } = useHaptics();
  const { enabled: visualEnabled, toggleEnabled: toggleVisual } = useVisualizer();

  const {
    importedTracks,
    activeTrack,
    loadedTrackId,
    isImporting,
    importStatus,
    processingProgress,
    importTrack,
    retryAnalysis,
    deleteTrack,
    selectTrack,
    playTrack,
  } = useLocalMusicLibrary();

  const handleToggleTrack = async (targetTrack: TrackMetadata) => {
    if (!isTrackPlayable(targetTrack.analysisStatus)) {
      Alert.alert(
        'Track Not Ready',
        `"${targetTrack.title}" is currently ${targetTrack.analysisStatus}. Please wait until analysis is Ready to Play.`
      );
      return;
    }

    try {
      const isCurrentLoaded =
        activeTrack.id === targetTrack.id && loadedTrackId === targetTrack.id;

      if (isCurrentLoaded) {
        if (isPlaying) {
          await pause();
        } else if (isPaused || isStopped) {
          if (isStopped && durationMs > 0 && positionMs >= durationMs) {
            await seek(0);
          }
          await resume();
        } else {
          await play();
        }
      } else {
        // Explicit user-triggered load + playback
        await playTrack(targetTrack, playback);
      }
    } catch (err: any) {
      Alert.alert(
        'Playback Notice',
        err?.message || `Unable to play "${targetTrack.title}".`
      );
    }
  };

  const handleImport = async () => {
    try {
      // Import and analyze in the background without starting playback or interrupting Spheres
      await importTrack();
    } catch (err: any) {
      Alert.alert(
        'Import Notice',
        err?.message || 'Could not import the selected audio file. Please ensure it is a valid audio format.'
      );
    }
  };

  const handleDelete = (track: TrackMetadata) => {
    Alert.alert(
      'Remove Track',
      `Are you sure you want to remove "${track.title}" from your VibeBridge library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (activeTrack.id === track.id && isPlaying) {
              await pause();
            }
            await deleteTrack(track.id);
          },
        },
      ]
    );
  };

  const isSpheresActive = activeTrack.id === BUNDLED_SPHERES_TRACK.id;

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
            {isSpheresActive ? (
              <Image
                source={spheresArtwork}
                style={styles.artworkImage}
                resizeMode="cover"
                accessibilityLabel="Spheres by Halina Rice Album Art"
              />
            ) : (
              <View style={[styles.customAudioHero, { backgroundColor: colors.background.elevated }]}>
                <Text style={styles.customAudioHeroEmoji}>🎵</Text>
                <Text style={[styles.customAudioHeroFormat, { color: colors.accent.secondary }]}>
                  {activeTrack.mimeType?.toUpperCase() || 'LOCAL AUDIO'}
                </Text>
              </View>
            )}

            {/* Live BPM Badge */}
            <View style={styles.bpmBadgeContainer}>
              <View style={[styles.bpmBadge, { backgroundColor: 'rgba(10, 14, 26, 0.85)' }]}>
                <View style={[styles.pulseDot, { backgroundColor: colors.accent.secondary }]} />
                <Text style={styles.bpmBadgeText}>
                  {activeTrack.bpm
                    ? `${activeTrack.bpm} BPM • Ready`
                    : isTrackPlayable(activeTrack.analysisStatus)
                    ? 'Ready to Play'
                    : activeTrack.analysisStatus === 'failed'
                    ? 'Analysis Incomplete'
                    : 'Analyzing Audio...'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.trackDetailsContainer}>
            <View style={styles.trackMetaRow}>
              <View style={styles.trackTitleCol}>
                <Text style={[styles.trackTitle, { color: colors.text.primary }]} numberOfLines={1}>
                  {activeTrack.title}
                </Text>
                <Text style={[styles.trackArtist, { color: colors.text.secondary }]} numberOfLines={1}>
                  {activeTrack.artist} • {activeTrack.isLocalImport ? 'Device Storage' : 'Electronic / Downtempo'}
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
              {activeTrack.summaryNote ||
                'Immerse yourself in synchronized visual rhythms, real-time kinetic wave motion, and calibrated tactile phone haptics.'}
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

        {/* 3. NATIVE IMPORT LOCAL MUSIC ACTION CARD */}
        <TouchableOpacity
          style={[styles.importMusicCard, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}
          onPress={handleImport}
          disabled={isImporting}
          activeOpacity={0.8}
          accessibilityLabel="Import Local Audio File"
          accessibilityRole="button"
        >
          <View style={[styles.importIconBox, { backgroundColor: colors.accent.primary }]}>
            {isImporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.importIconText}>📂</Text>
            )}
          </View>
          <View style={styles.importInfoCol}>
            <Text style={[styles.importTitle, { color: colors.text.primary }]}>
              {isImporting ? 'Importing Audio Track...' : 'Import Local Music'}
            </Text>
            <Text style={[styles.importSub, { color: colors.text.secondary }]}>
              {isImporting
                ? importStatus || 'Analyzing rhythm & detecting BPM...'
                : 'Select MP3, WAV, M4A, FLAC from Downloads or Storage'}
            </Text>
          </View>
          <View style={[styles.importActionPill, { backgroundColor: colors.accent.secondary }]}>
            <Text style={styles.importActionPillText}>{isImporting ? 'ANALYZING' : '+ IMPORT'}</Text>
          </View>
        </TouchableOpacity>

        {/* 4. Sensory Controls & Real-Time Indicators */}
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

        {/* 5. PROMINENT ENTRY POINT: LEARN TO PLAY MUSIC */}
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

        {/* 6. Music Catalog / Available Selections */}
        <View style={styles.catalogSection}>
          <View style={styles.catalogHeader}>
            <Text style={[styles.catalogTitle, { color: colors.text.primary }]}>Available Music</Text>
            <Text style={[styles.catalogBadge, { color: colors.accent.secondary }]}>
              {1 + importedTracks.length} Available
            </Text>
          </View>

          {/* Item 1: Spheres (Bundled Studio Demo) */}
          <TouchableOpacity
            style={[
              styles.catalogCard,
              {
                backgroundColor: isSpheresActive ? colors.background.elevated : colors.background.secondary,
                borderColor: isSpheresActive ? colors.accent.primary : colors.border.subtle,
              },
            ]}
            onPress={() => handleToggleTrack(BUNDLED_SPHERES_TRACK)}
            activeOpacity={0.8}
          >
            <Image source={spheresArtwork} style={styles.catalogThumb} resizeMode="cover" />
            <View style={styles.catalogInfo}>
              <View style={styles.catalogTitleRow}>
                <Text style={[styles.catalogTrackTitle, { color: colors.text.primary }]}>Spheres</Text>
                <View style={[styles.badgePill, { backgroundColor: 'rgba(70, 87, 213, 0.15)' }]}>
                  <Text style={[styles.badgePillText, { color: colors.accent.primary }]}>DEMO</Text>
                </View>
              </View>
              <Text style={[styles.catalogTrackArtist, { color: colors.text.secondary }]}>
                Halina Rice • 120 BPM • Synchronized Visuals & Haptics
              </Text>
            </View>
            <View
              style={[
                styles.playPill,
                { backgroundColor: isSpheresActive && isPlaying ? colors.accent.secondary : colors.accent.primary },
              ]}
            >
              <Text style={styles.playPillText}>
                {isSpheresActive && isPlaying ? 'PAUSE' : 'PLAY'}
              </Text>
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

          {/* 7. IMPORTED USER TRACKS */}
          {importedTracks.length > 0 && (
            <View style={styles.importedSection}>
              <View style={styles.importedHeaderRow}>
                <Text style={[styles.importedSectionTitle, { color: colors.text.primary }]}>
                  Imported Local Library
                </Text>
                <Text style={[styles.importedCountText, { color: colors.text.secondary }]}>
                  {importedTracks.length} {importedTracks.length === 1 ? 'Track' : 'Tracks'}
                </Text>
              </View>

              {importedTracks.map((item) => {
                const isPlayable = isTrackPlayable(item.analysisStatus);
                const isItemActive = activeTrack.id === item.id;
                const isItemPlaying = isItemActive && isPlaying;
                const progress = processingProgress[item.id];

                // Render miniature TrackProcessingCard for tracks in importing, decoding, analyzing, saving, or failed
                if (!isPlayable) {
                  return (
                    <TrackProcessingCard
                      key={item.id}
                      track={item}
                      progress={progress}
                      onRetry={(id) => retryAnalysis(id)}
                      onDelete={(id) => handleDelete(item)}
                    />
                  );
                }

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.importedCard,
                      {
                        backgroundColor: isItemActive ? colors.background.elevated : colors.background.secondary,
                        borderColor: isItemActive ? colors.accent.primary : colors.border.subtle,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.importedMainArea}
                      onPress={() => {
                        selectTrack(item);
                        router.push('/player' as any);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.importedThumb, { backgroundColor: colors.background.base }]}>
                        <Text style={styles.importedThumbEmoji}>🎵</Text>
                      </View>
                      <View style={styles.importedInfo}>
                        <Text style={[styles.importedTitle, { color: colors.text.primary }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.importedMeta, { color: colors.text.secondary }]} numberOfLines={1}>
                          {item.artist}
                        </Text>
                        <View style={styles.analysisBadgeRow}>
                          <View style={[styles.analysisPill, { backgroundColor: 'rgba(21, 158, 152, 0.15)' }]}>
                            <Text style={[styles.analysisPillText, { color: colors.accent.secondary }]}>
                              ⚡ {item.bpm ? `${item.bpm} BPM (Ready)` : 'Ready to Play'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Actions: Play/Pause and Delete */}
                    <View style={styles.importedActions}>
                      <TouchableOpacity
                        style={[
                          styles.playPillMini,
                          { backgroundColor: isItemPlaying ? colors.accent.secondary : colors.accent.primary },
                        ]}
                        onPress={() => handleToggleTrack(item)}
                        accessibilityLabel={isItemPlaying ? 'Pause track' : 'Play track'}
                      >
                        <Text style={styles.playPillMiniText}>{isItemPlaying ? 'PAUSE' : 'PLAY'}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.deleteBtn, { backgroundColor: colors.background.base }]}
                        onPress={() => handleDelete(item)}
                        accessibilityLabel="Remove track"
                      >
                        <Text style={styles.deleteIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {importedTracks.length === 0 && (
            <View style={[styles.emptyImportBox, { borderColor: colors.border.subtle }]}>
              <Text style={styles.emptyImportEmoji}>📁</Text>
              <Text style={[styles.emptyImportTitle, { color: colors.text.primary }]}>
                No Local Audio Imported Yet
              </Text>
              <Text style={[styles.emptyImportSub, { color: colors.text.secondary }]}>
                Import songs from your device to automatically detect tempo and generate synchronized tactile haptics.
              </Text>
            </View>
          )}
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
    marginBottom: 16,
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
  customAudioHero: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAudioHeroEmoji: {
    fontSize: 56,
  },
  customAudioHeroFormat: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 8,
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
  importMusicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  importIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importIconText: {
    fontSize: 22,
  },
  importInfoCol: {
    flex: 1,
  },
  importTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  importSub: {
    fontSize: 12,
    marginTop: 2,
  },
  importActionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  importActionPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
  catalogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catalogTrackTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '800',
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
  importedSection: {
    marginTop: 14,
  },
  importedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  importedSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  importedCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  importedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  importedMainArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  importedThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importedThumbEmoji: {
    fontSize: 22,
  },
  importedInfo: {
    flex: 1,
  },
  importedTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  importedMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  analysisBadgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  analysisPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  analysisPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  importedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playPillMini: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  playPillMiniText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 14,
  },
  emptyImportBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyImportEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyImportTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyImportSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
