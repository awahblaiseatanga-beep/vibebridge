/**
 * LiveConcertCard
 *
 * Primary user interface for Live Concert Mode.
 * Stage B-LIVE.2: Adaptive Haptic Intelligence, Physical Feedback Calibration & Haptic Testing Studio.
 *
 * Enables Deaf and hard-of-hearing audience members to capture live music
 * via the device microphone, experience calibrated physical tactile feedback,
 * and independently test and compare vibration patterns in an offline studio.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Card } from '@/components/common';
import { theme } from '@/theme';
import { useLiveConcert } from '../useLiveConcert';

export function LiveConcertCard() {
  const {
    state,
    hapticConfig,
    hapticStats,
    isCapturing,
    isStarting,
    permissionStatus,
    features,
    lastHapticEvent,
    errorMessage,
    startListening,
    stopListening,
    setHapticEnabled,
    setIntensityProfile,
    setSensitivityProfile,
    setAutoAdaptSensitivity,
    testPattern,
    cancelHaptics,
  } = useLiveConcert();

  const renderPermissionNotice = () => {
    if (permissionStatus === 'denied') {
      return (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTitle}>⚠️ Microphone Access Denied</Text>
          <Text style={styles.errorBannerText}>
            Live Concert Mode requires microphone access to capture ambient music.
            Please grant permission in device settings.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={startListening}
            accessibilityLabel="Retry microphone permission"
          >
            <Text style={styles.retryButtonText}>Retry Permission Request</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  const getHapticEventLabel = () => {
    if (!lastHapticEvent || lastHapticEvent.type === 'none') {
      return 'Waiting for musical cue...';
    }
    const ms = lastHapticEvent.durationMs > 0 ? ` (${lastHapticEvent.durationMs}ms)` : '';
    const driverTag =
      lastHapticEvent.driverMode === 'native-vibration' ? ' • Hardware Rail' : ' • Platform Haptics';

    switch (lastHapticEvent.type) {
      case 'bass_punch':
        return `💥 Bass Punch${ms}${driverTag}`;
      case 'percussion_snap':
        return `🥁 Percussion Snap${ms}${driverTag}`;
      case 'vocal_pulse':
        return `🎤 Vocal-Range Pulse${ms}${driverTag}`;
      case 'melody_tick':
        return `✨ Melodic Sparkle${ms}${driverTag}`;
      default:
        return 'Tactile Idle';
    }
  };

  return (
    <Card style={styles.card} variant="elevated">
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.liveIndicator,
                isCapturing && styles.liveIndicatorActive,
              ]}
            />
            <Text style={styles.cardEyebrow}>
              {isCapturing ? 'LIVE CONCERT STREAMING' : 'LIVE CONCERT MODE'}
            </Text>
          </View>
          <Text style={styles.cardTitle}>Real-Time Acoustic Translation</Text>
        </View>
      </View>

      <Text style={styles.cardDescription}>
        Captures live acoustic music through your microphone and translates musical
        beats, bass weight, and transients into synchronized physical vibrations.
      </Text>

      {/* Permission or Error Banner */}
      {renderPermissionNotice()}
      {errorMessage && permissionStatus !== 'denied' && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ {errorMessage}</Text>
        </View>
      )}

      {/* Main Start / Stop Button */}
      <View style={styles.actionContainer}>
        {isCapturing ? (
          <TouchableOpacity
            style={[styles.primaryButton, styles.stopButton]}
            onPress={stopListening}
            accessibilityLabel="Stop listening to live concert"
          >
            <Text style={styles.buttonIcon}>⏹</Text>
            <Text style={styles.primaryButtonText}>Stop Listening</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, styles.startButton]}
            onPress={startListening}
            disabled={isStarting}
            accessibilityLabel="Start listening to live concert"
          >
            {isStarting ? (
              <ActivityIndicator color="#090D16" size="small" />
            ) : (
              <>
                <Text style={styles.buttonIcon}>🎤</Text>
                <Text style={styles.primaryButtonText}>
                  Start Live Concert Listening
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Real-time Spectrum Meters (Visible when capturing or testing) */}
      <View style={styles.spectrumSection}>
        <View style={styles.spectrumHeaderRow}>
          <Text style={styles.sectionSubtitle}>Live Acoustic Frequency Decomposition</Text>
          <Text style={styles.snrBadge}>
            SNR: {Math.round(features.snrDb)} dB • Floor: {Math.round(features.noiseFloor * 100)}%
          </Text>
        </View>

        {/* Low Frequency / Bass */}
        <View style={styles.meterRow}>
          <View style={styles.meterLabelContainer}>
            <Text style={styles.meterLabel}>🟢 Bass / Sub (&lt;250 Hz)</Text>
            <Text style={styles.meterValue}>
              {Math.round(features.lowEnergy * 100)}%
            </Text>
          </View>
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                { width: `${Math.round(features.lowEnergy * 100)}%`, backgroundColor: '#22C55E' },
              ]}
            />
          </View>
        </View>

        {/* Mid Frequency */}
        <View style={styles.meterRow}>
          <View style={styles.meterLabelContainer}>
            <Text style={styles.meterLabel}>🟡 Mid / Instruments (250-2500 Hz)</Text>
            <Text style={styles.meterValue}>
              {Math.round(features.midEnergy * 100)}%
            </Text>
          </View>
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                { width: `${Math.round(features.midEnergy * 100)}%`, backgroundColor: '#F59E0B' },
              ]}
            />
          </View>
        </View>

        {/* High Frequency */}
        <View style={styles.meterRow}>
          <View style={styles.meterLabelContainer}>
            <Text style={styles.meterLabel}>🔵 High / Cymbals (&gt;2500 Hz)</Text>
            <Text style={styles.meterValue}>
              {Math.round(features.highEnergy * 100)}%
            </Text>
          </View>
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                { width: `${Math.round(features.highEnergy * 100)}%`, backgroundColor: '#38BDF8' },
              ]}
            />
          </View>
        </View>

        {/* Estimated Vocal-Range Activity */}
        <View style={styles.vocalSection}>
          <View style={styles.meterLabelContainer}>
            <Text style={styles.vocalLabel}>🎤 Vocal-Range Activity</Text>
            <Text style={styles.meterValue}>
              {Math.round(features.vocalActivityEstimate * 100)}%
            </Text>
          </View>
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.round(features.vocalActivityEstimate * 100)}%`,
                  backgroundColor: theme.colors.sensory.feel,
                },
              ]}
            />
          </View>
          <Text style={styles.vocalDisclaimer}>
            * Estimated acoustic energy in human voice band (300–3000 Hz).
            Not confirmed singer source separation.
          </Text>
        </View>

        {/* Transient Hit Indicator & Effective Sensitivity */}
        <View style={styles.transientRow}>
          <View style={styles.transientContainer}>
            <Text style={styles.transientLabel}>Transient Beat Impact:</Text>
            <View
              style={[
                styles.transientPill,
                features.isTransient && styles.transientPillActive,
              ]}
            >
              <Text
                style={[
                  styles.transientText,
                  features.isTransient && styles.transientTextActive,
                ]}
              >
                {features.isTransient ? '⚡ BEAT ONSET' : 'STEADY'}
              </Text>
            </View>
          </View>

          <View style={styles.sensitivityPillContainer}>
            <Text style={styles.sensitivityPillLabel}>Effective Gain:</Text>
            <Text style={styles.sensitivityPillValue}>
              {features.effectiveSensitivity ? `${features.effectiveSensitivity.toFixed(2)}x` : '1.00x'}
            </Text>
          </View>
        </View>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* STAGE B-LIVE.2: HAPTIC TESTING STUDIO (OFFLINE ACTUATOR LAB)   */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.studioContainer}>
        <View style={styles.studioHeaderRow}>
          <View>
            <Text style={styles.studioTitle}>🎛️ Haptic Testing Studio</Text>
            <Text style={styles.studioSubtitle}>
              Test and compare physical tactile patterns without microphone input
            </Text>
          </View>
          <TouchableOpacity
            style={styles.silenceButton}
            onPress={cancelHaptics}
            accessibilityLabel="Immediately mute and silence vibration actuator"
          >
            <Text style={styles.silenceButtonText}>🔇 Silence</Text>
          </TouchableOpacity>
        </View>

        {/* Test Trigger Buttons Grid */}
        <View style={styles.testButtonsGrid}>
          <TouchableOpacity
            style={[styles.testButton, styles.testButtonBass]}
            onPress={() => testPattern('bass_punch')}
            accessibilityLabel="Test Bass Punch Pattern"
          >
            <Text style={styles.testButtonIcon}>💥</Text>
            <Text style={styles.testButtonText}>Test Bass Punch</Text>
            <Text style={styles.testButtonSubtext}>
              {hapticConfig.intensityProfile === 'strong' ? '60ms Full-Rail' : 'Heavy Impact'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, styles.testButtonPercussion]}
            onPress={() => testPattern('percussion_snap')}
            accessibilityLabel="Test Percussion Snap Pattern"
          >
            <Text style={styles.testButtonIcon}>🥁</Text>
            <Text style={styles.testButtonText}>Test Percussion</Text>
            <Text style={styles.testButtonSubtext}>
              {hapticConfig.intensityProfile === 'strong' ? '30ms Crisp Pulse' : 'Medium Impact'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, styles.testButtonVocal]}
            onPress={() => testPattern('vocal_pulse')}
            accessibilityLabel="Test Vocal Pulse Pattern"
          >
            <Text style={styles.testButtonIcon}>🎤</Text>
            <Text style={styles.testButtonText}>Test Vocal Pulse</Text>
            <Text style={styles.testButtonSubtext}>
              {hapticConfig.intensityProfile === 'strong' ? '18ms Gentle Flutter' : 'Light Impact'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, styles.testButtonMelody]}
            onPress={() => testPattern('melody_tick')}
            accessibilityLabel="Test Melodic Sparkle Pattern"
          >
            <Text style={styles.testButtonIcon}>✨</Text>
            <Text style={styles.testButtonText}>Test Melodic Sparkle</Text>
            <Text style={styles.testButtonSubtext}>
              {hapticConfig.intensityProfile === 'strong' ? 'Double Pulse' : 'Tick'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Physical Intensity Profile Calibration Selector */}
        <View style={styles.controlGroup}>
          <View style={styles.controlHeaderRow}>
            <Text style={styles.controlLabel}>Physical Intensity Profile (Actuator Calibration)</Text>
            <Text style={styles.controlModeBadge}>
              Mode: {hapticConfig.intensityProfile === 'strong' ? '⚡ Hardware Rail' : '🌊 Platform Waveform'}
            </Text>
          </View>
          <View style={styles.selectorRow}>
            <TouchableOpacity
              style={[
                styles.selectorOption,
                hapticConfig.intensityProfile === 'subtle' && styles.selectorOptionActive,
              ]}
              onPress={() => setIntensityProfile('subtle')}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  hapticConfig.intensityProfile === 'subtle' && styles.selectorOptionTextActive,
                ]}
              >
                Subtle
              </Text>
              <Text style={styles.selectorOptionSubtext}>Platform Light</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectorOption,
                hapticConfig.intensityProfile === 'balanced' && styles.selectorOptionActive,
              ]}
              onPress={() => setIntensityProfile('balanced')}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  hapticConfig.intensityProfile === 'balanced' && styles.selectorOptionTextActive,
                ]}
              >
                Balanced
              </Text>
              <Text style={styles.selectorOptionSubtext}>Platform Heavy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectorOption,
                styles.selectorOptionStrong,
                hapticConfig.intensityProfile === 'strong' && styles.selectorOptionStrongActive,
              ]}
              onPress={() => setIntensityProfile('strong')}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  hapticConfig.intensityProfile === 'strong' && styles.selectorOptionTextActive,
                ]}
              >
                Strong (Max)
              </Text>
              <Text style={styles.selectorOptionSubtext}>Full-Rail Drive</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Acoustic Detection Sensitivity Profile Selector */}
        <View style={styles.controlGroup}>
          <View style={styles.controlHeaderRow}>
            <Text style={styles.controlLabel}>Acoustic Sensitivity Profile</Text>
            <TouchableOpacity
              style={[
                styles.autoAdaptToggle,
                hapticConfig.autoAdaptSensitivity && styles.autoAdaptToggleActive,
              ]}
              onPress={() => setAutoAdaptSensitivity(!hapticConfig.autoAdaptSensitivity)}
            >
              <Text
                style={[
                  styles.autoAdaptToggleText,
                  hapticConfig.autoAdaptSensitivity && styles.autoAdaptToggleTextActive,
                ]}
              >
                {hapticConfig.autoAdaptSensitivity ? '⚡ Auto-Adapt: ON' : 'Auto-Adapt: OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.selectorRow}>
            <TouchableOpacity
              style={[
                styles.selectorOption,
                hapticConfig.sensitivityProfile === 'low' && styles.selectorOptionActive,
              ]}
              onPress={() => setSensitivityProfile('low')}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  hapticConfig.sensitivityProfile === 'low' && styles.selectorOptionTextActive,
                ]}
              >
                Low (0.65x)
              </Text>
              <Text style={styles.selectorOptionSubtext}>Loud Arenas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectorOption,
                hapticConfig.sensitivityProfile === 'normal' && styles.selectorOptionActive,
              ]}
              onPress={() => setSensitivityProfile('normal')}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  hapticConfig.sensitivityProfile === 'normal' && styles.selectorOptionTextActive,
                ]}
              >
                Normal (1.0x)
              </Text>
              <Text style={styles.selectorOptionSubtext}>Clubs / Rehearsal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectorOption,
                hapticConfig.sensitivityProfile === 'high' && styles.selectorOptionActive,
              ]}
              onPress={() => setSensitivityProfile('high')}
            >
              <Text
                style={[
                  styles.selectorOptionText,
                  hapticConfig.sensitivityProfile === 'high' && styles.selectorOptionTextActive,
                ]}
              >
                High (1.8x)
              </Text>
              <Text style={styles.selectorOptionSubtext}>Acoustic / Quiet</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Tactile Feedback HUD */}
        <View style={styles.hapticFeedbackHUD}>
          <Text style={styles.hudLabel}>Active Tactile Impulse:</Text>
          <Text style={styles.hudEventText}>{getHapticEventLabel()}</Text>
        </View>

        {/* Observable Telemetry Counters */}
        <View style={styles.telemetryRow}>
          <Text style={styles.telemetryText}>
            Triggered: <Text style={styles.telemetryHighlight}>{hapticStats.totalTriggers}</Text>
          </Text>
          <Text style={styles.telemetryText}>
            Throttled (45ms): <Text style={styles.telemetryHighlight}>{hapticStats.totalThrottled}</Text>
          </Text>
          <Text style={styles.telemetryText}>
            Suppressed: <Text style={styles.telemetryHighlight}>{hapticStats.totalSuppressed}</Text>
          </Text>
        </View>

        {/* Hardware Actuator Transparency Notice */}
        <Text style={styles.hardwareDisclaimer}>
          ℹ️ Hardware Note: Subtle &amp; Balanced profiles trigger Android platform waveforms (amplitudes $\le$ 70/255).
          Strong profile uses direct hardware rail pulses (bounded 18–60ms) to overcome mechanical rise-time on Android ERM actuators.
        </Text>
      </View>

      {/* Hardware Status Footer */}
      <View style={styles.deviceStatusFooter}>
        <Text style={styles.statusFooterText}>
          Microphone: {state.sampleRate} Hz • {state.channels === 1 ? 'Mono' : 'Stereo'} • Buffer: ~100ms
        </Text>
        <Text style={styles.statusFooterText}>
          Packets: {state.packetsReceived} • Noise Floor: {Math.round(features.noiseFloor * 100)}% • 100% Offline
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  titleContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.text.muted,
    marginRight: 6,
  },
  liveIndicatorActive: {
    backgroundColor: theme.colors.status.error,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.sensory.feel,
    letterSpacing: 1.2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  cardDescription: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  errorBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.status.error,
    marginBottom: 4,
  },
  errorBannerText: {
    fontSize: 12,
    color: theme.colors.text.primary,
    lineHeight: 16,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: theme.colors.status.error,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionContainer: {
    marginBottom: theme.spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    gap: 8,
  },
  startButton: {
    backgroundColor: theme.colors.sensory.feel,
  },
  stopButton: {
    backgroundColor: theme.colors.status.error,
  },
  buttonIcon: {
    fontSize: 16,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#090D16',
  },
  spectrumSection: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  spectrumHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  snrBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text.muted,
  },
  meterRow: {
    marginBottom: 8,
  },
  meterLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  meterLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  meterValue: {
    fontSize: 12,
    color: theme.colors.text.primary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  meterTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  vocalSection: {
    marginTop: 2,
    marginBottom: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  vocalLabel: {
    fontSize: 12,
    color: theme.colors.sensory.feel,
    fontWeight: '700',
  },
  vocalDisclaimer: {
    fontSize: 10,
    color: theme.colors.text.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  transientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  transientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transientLabel: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  transientPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  transientPillActive: {
    backgroundColor: '#F59E0B',
  },
  transientText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text.muted,
  },
  transientTextActive: {
    color: '#090D16',
  },
  sensitivityPillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sensitivityPillLabel: {
    fontSize: 11,
    color: theme.colors.text.muted,
  },
  sensitivityPillValue: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.sensory.feel,
    fontVariant: ['tabular-nums'],
  },
  // Studio section
  studioContainer: {
    backgroundColor: 'rgba(244, 63, 94, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  studioHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  studioTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.sensory.feel,
    letterSpacing: 0.5,
  },
  studioSubtitle: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  silenceButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
  },
  silenceButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.status.error,
  },
  testButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  testButton: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: theme.colors.background.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  testButtonBass: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  testButtonPercussion: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  testButtonVocal: {
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  testButtonMelody: {
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  testButtonIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  testButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  testButtonSubtext: {
    fontSize: 9,
    color: theme.colors.text.muted,
    marginTop: 1,
  },
  controlGroup: {
    marginBottom: theme.spacing.sm,
  },
  controlHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  controlModeBadge: {
    fontSize: 10,
    color: theme.colors.sensory.feel,
    fontWeight: '600',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  selectorOption: {
    flex: 1,
    backgroundColor: theme.colors.background.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  selectorOptionActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: theme.colors.sensory.feel,
  },
  selectorOptionStrong: {
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  selectorOptionStrongActive: {
    backgroundColor: theme.colors.sensory.feel,
    borderColor: theme.colors.sensory.feel,
  },
  selectorOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text.muted,
  },
  selectorOptionTextActive: {
    color: theme.colors.text.primary,
    fontWeight: '800',
  },
  selectorOptionSubtext: {
    fontSize: 9,
    color: theme.colors.text.muted,
    marginTop: 1,
  },
  autoAdaptToggle: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  autoAdaptToggleActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: '#22C55E',
    borderWidth: 1,
  },
  autoAdaptToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text.muted,
  },
  autoAdaptToggleTextActive: {
    color: '#22C55E',
  },
  hapticFeedbackHUD: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: 6,
  },
  hudLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.text.muted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  hudEventText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.sensory.feel,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 4,
  },
  telemetryText: {
    fontSize: 10,
    color: theme.colors.text.muted,
  },
  telemetryHighlight: {
    fontWeight: '700',
    color: theme.colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  hardwareDisclaimer: {
    fontSize: 9,
    color: theme.colors.text.muted,
    lineHeight: 13,
    fontStyle: 'italic',
  },
  deviceStatusFooter: {
    alignItems: 'center',
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 2,
  },
  statusFooterText: {
    fontSize: 10,
    color: theme.colors.text.muted,
  },
});
