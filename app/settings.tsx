import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Paths, File } from 'expo-file-system';
import { useAppTheme } from '@/theme';
import { Card, BottomNavigation } from '@/components/common';
import { useHaptics } from '@/features/haptics';
import { LocalTrackRepository } from '@/services/tracks';
import {
  checkAudioDecoderAvailability,
  checkNativeHapticsCapabilities,
  probeAudioFileNative,
  streamDecodeAudioFileNative,
  NativeAudioDecoderAvailability,
  NativeAudioDecodeResponse,
  NativeHapticsCapabilities,
} from '@/native';

function buildDiagnosticWavBytes(sampleRate = 44100, channels = 2, durationSec = 2): Uint8Array {
  const frameCount = sampleRate * durationSec;
  const dataBytes = frameCount * channels * 2;
  const buffer = new Uint8Array(44 + dataBytes);
  const view = new DataView(buffer.buffer);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < frameCount; i++) {
    const val = Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 12000);
    for (let c = 0; c < channels; c++) {
      view.setInt16(44 + (i * channels + c) * 2, val, true);
    }
  }
  return buffer;
}

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const { enabled: hapticsEnabled, toggleEnabled: toggleHaptics } = useHaptics();
  const [decoderStatus, setDecoderStatus] = useState<NativeAudioDecoderAvailability | null>(null);
  const [hapticsCaps, setHapticsCaps] = useState<NativeHapticsCapabilities | null>(null);
  const [pcmTestSummary, setPcmTestSummary] = useState<string | null>(null);
  const [isTestingPcm, setIsTestingPcm] = useState(false);
  const [devModeUnlocked, setDevModeUnlocked] = useState(false);
  const [versionTapCount, setVersionTapCount] = useState(0);

  const handleVersionTap = () => {
    const next = versionTapCount + 1;
    setVersionTapCount(next);
    if (next >= 5) {
      setDevModeUnlocked(true);
    }
  };

  const refreshNativeStatus = useCallback(async () => {
    const [decoder, haptics] = await Promise.all([
      checkAudioDecoderAvailability(),
      checkNativeHapticsCapabilities(),
    ]);
    setDecoderStatus(decoder);
    setHapticsCaps(haptics);
  }, []);

  const handleTestPcmDecode = useCallback(async () => {
    try {
      setIsTestingPcm(true);
      setPcmTestSummary('Select an audio file to decode...');
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', '*/*'],
        copyToCacheDirectory: false,
      });
      if (picked.canceled || !picked.assets || picked.assets.length === 0) {
        setPcmTestSummary('PCM decode test canceled.');
        return;
      }

      const asset = picked.assets[0];
      setPcmTestSummary(`Decoding ${asset.name}...`);
      const res: NativeAudioDecodeResponse = await streamDecodeAudioFileNative(
        { uri: asset.uri },
        {
          onProgress: (p) => {
            if (p.phase === 'decoding') {
              setPcmTestSummary(
                `Decoding ${Math.round(p.progress * 100)}% (${p.sampleRate} Hz, ${p.chunksDecoded} chunks)`
              );
            }
          },
        }
      );

      console.log('[VibeBridge M1 PCM Verify]', JSON.stringify({ file: asset.name, ...res }));

      if (res.status === 'executed') {
        setPcmTestSummary(
          `Decoded ${res.mimeType} (${res.codecName}): ${res.sampleRate}Hz ${res.channelCount}ch ${res.pcmEncoding}, frames=${res.totalFramesDecoded}, bytes=${res.totalPcmBytesDecoded}, pts=${res.firstTimestampMs}..${res.lastTimestampMs}ms, eos=${String(res.reachedEos)}, maxChunk=${res.maxChunkBytesObserved}B`
        );
      } else {
        setPcmTestSummary(`Failed (${res.errorCode || res.status}): ${res.error}`);
      }
    } catch (err: any) {
      setPcmTestSummary(`Error: ${err?.message || 'Unknown decode failure'}`);
    } finally {
      setIsTestingPcm(false);
    }
  }, []);

  const handleRunEdgeTests = useCallback(async () => {
    const corruptFile = new File(Paths.cache, 'm1_corrupt_test.mp3');
    const textFile = new File(Paths.cache, 'm1_text_test.bin');
    const wavFile = new File(Paths.cache, 'm1_wav_test.wav');

    try {
      setIsTestingPcm(true);
      setPcmTestSummary('Running M1 corrupt, WAV, cancel & library checks...');

      // 1. Corrupt MP3 recovery
      corruptFile.write(new Uint8Array([0x01, 0x02, 0x03, 0xff, 0xee, 0xdd, 0x11, 0x22]));
      const corruptProbe = await probeAudioFileNative(corruptFile.uri);
      const corruptDecode = await streamDecodeAudioFileNative({ uri: corruptFile.uri });

      // 2. Non-audio container recovery
      textFile.write(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x57, 0x6f]));
      const textProbe = await probeAudioFileNative(textFile.uri);

      // 3. Real 44.1kHz stereo WAV full-stream + mid-stream cancellation
      wavFile.write(buildDiagnosticWavBytes(44100, 2, 2));
      const wavFull = await streamDecodeAudioFileNative({ uri: wavFile.uri });
      let sawFirstChunk = false;
      const wavCancel = await streamDecodeAudioFileNative(
        { uri: wavFile.uri },
        {
          onChunk: () => {
            sawFirstChunk = true;
          },
          isCancelled: () => sawFirstChunk,
        }
      );

      // 4. Decode any imported local tracks in repository
      const allTracks = await LocalTrackRepository.getAllTracks();
      const importedResults: any[] = [];
      for (const track of allTracks) {
        if (!track.isLocalImport) continue;
        const r = await streamDecodeAudioFileNative({ uri: track.uri });
        importedResults.push({ title: track.title, uri: track.uri, ...r });
      }

      const payload = {
        corruptProbe: { status: corruptProbe.status, errorCode: corruptProbe.errorCode },
        corruptDecode: { status: corruptDecode.status, errorCode: corruptDecode.errorCode },
        textProbe: { status: textProbe.status, errorCode: textProbe.errorCode },
        wavFull,
        wavCancel: {
          status: wavCancel.status,
          errorCode: wavCancel.errorCode,
          cancelled: wavCancel.cancelled,
          chunksDecoded: wavCancel.chunksDecoded,
          reachedEos: wavCancel.reachedEos,
        },
        importedCount: importedResults.length,
        importedResults,
      };
      console.log('[VibeBridge M1 Edge Suite]', JSON.stringify(payload));
      setPcmTestSummary(
        `Edge OK: corrupt=${corruptDecode.errorCode}, wav=${wavFull.sampleRate}Hz/${wavFull.totalFramesDecoded}f(eos=${String(wavFull.reachedEos)}), cancelChunks=${wavCancel.chunksDecoded}, imported=${importedResults.length}`
      );
    } catch (err: any) {
      setPcmTestSummary(`Edge suite error: ${err?.message || 'Unknown failure'}`);
    } finally {
      try { if (corruptFile.exists) corruptFile.delete(); } catch {}
      try { if (textFile.exists) textFile.delete(); } catch {}
      try { if (wavFile.exists) wavFile.delete(); } catch {}
      setIsTestingPcm(false);
    }
  }, []);

  useEffect(() => {
    void refreshNativeStatus();
  }, [refreshNativeStatus]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Application preferences and hardware calibration.
          </Text>
        </View>

        {/* Theme Settings (Verified Design Tokens) */}
        <Card variant="surface" style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Appearance</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Dark Theme</Text>
              <Text style={[styles.settingSub, { color: colors.text.secondary }]}>
                Tactile Resonance Dark Foundation (#111722)
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border.subtle, true: colors.accent.primary }}
              thumbColor={colors.background.elevated}
            />
          </View>
        </Card>

        {/* Haptics Settings */}
        <Card variant="surface" style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Haptics & Vibration</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Phone Haptics</Text>
              <Text style={[styles.settingSub, { color: colors.text.secondary }]}>
                Tactile vibration motor actuation during reference learning
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={toggleHaptics}
              trackColor={{ false: colors.border.subtle, true: colors.accent.primary }}
              thumbColor={colors.background.elevated}
            />
          </View>
        </Card>

        {/* Developer Diagnostics & Native Foundation Verification (Guarded in Submission Builds) */}
        {(__DEV__ || devModeUnlocked) && (
          <Card variant="surface" style={styles.card}>
            <View style={styles.nativeHeaderRow}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
                  Developer Diagnostics
                </Text>
                <Text style={[styles.settingSub, { color: colors.text.secondary }]}>
                  Hardware verification tools. Normal music import occurs on the Explore screen.
                </Text>
              </View>
              <TouchableOpacity
                onPress={refreshNativeStatus}
                style={[styles.refreshPill, { borderColor: colors.border.subtle, backgroundColor: colors.background.elevated }]}
                accessibilityLabel="Refresh native module status"
              >
                <Text style={[styles.refreshText, { color: colors.accent.primary }]}>Re-check</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.settingSub, { color: colors.text.secondary }]}>
              Audio Decoder: {decoderStatus
                ? decoderStatus.moduleInstalled
                  ? `Installed • Implemented=${String(decoderStatus.decoderImplemented)} (${decoderStatus.supportedFormats.join(', ') || 'none'})`
                  : `Not installed (${decoderStatus.status})`
                : 'Checking...'}
            </Text>

            <Text style={[styles.settingSub, { color: colors.text.secondary }]}>
              Native Haptics: {hapticsCaps
                ? hapticsCaps.moduleInstalled
                  ? `Installed • Vibrator=${String(hapticsCaps.hasVibrator)} • Amplitude=${String(hapticsCaps.hasAmplitudeControl)} • Primitives=${String(hapticsCaps.supportsPrimitives)}`
                  : `Not installed (${hapticsCaps.status})`
                : 'Checking...'}
            </Text>

            <View style={styles.nativeHeaderRow}>
              <TouchableOpacity
                onPress={handleTestPcmDecode}
                disabled={isTestingPcm}
                style={[styles.refreshPill, { borderColor: colors.border.subtle, backgroundColor: colors.background.elevated }]}
                accessibilityLabel="Test native PCM decode"
              >
                <Text style={[styles.refreshText, { color: colors.accent.secondary }]}>
                  {isTestingPcm ? 'Decoding...' : 'Test PCM Decode'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRunEdgeTests}
                disabled={isTestingPcm}
                style={[styles.refreshPill, { borderColor: colors.border.subtle, backgroundColor: colors.background.elevated }]}
                accessibilityLabel="Run Milestone 1 edge tests"
              >
                <Text style={[styles.refreshText, { color: colors.accent.primary }]}>
                  Run M1 Edge Tests
                </Text>
              </TouchableOpacity>
            </View>

            {pcmTestSummary && (
              <Text style={[styles.settingSub, { color: colors.text.primary }]}>
                {pcmTestSummary}
              </Text>
            )}
          </Card>
        )}

        {/* Application Information & Build Metadata */}
        <Card variant="surface" style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleVersionTap}
            accessibilityLabel="Application Information"
          >
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>About VibeBridge</Text>
            <Text style={[styles.settingSub, { color: colors.text.secondary, marginTop: 4 }]}>
              Version 1.0.0 (CIMFEST 2026 Submission Build)
            </Text>
            <Text style={[styles.settingSub, { color: colors.text.secondary, marginTop: 2 }]}>
              Multimodal Sensory Music Platform for Deaf, Hard of Hearing & Acoustic Explorers
            </Text>
            {versionTapCount > 0 && versionTapCount < 5 && !devModeUnlocked && (
              <Text style={[styles.settingSub, { color: colors.accent.primary, marginTop: 4 }]}>
                Tap {5 - versionTapCount} more times to unlock Developer Diagnostics
              </Text>
            )}
            {devModeUnlocked && (
              <Text style={[styles.settingSub, { color: colors.accent.secondary, marginTop: 4 }]}>
                ✓ Developer Diagnostics Unlocked
              </Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Pending Settings Notice (Honest State) */}
        <Card variant="secondary" style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeIcon}>ℹ️</Text>
            <View style={styles.noticeTextCol}>
              <Text style={[styles.noticeTitle, { color: colors.text.primary }]}>
                Settings Design In Progress
              </Text>
              <Text style={[styles.noticeDesc, { color: colors.text.secondary }]}>
                Comprehensive Bluetooth device pairing, audio latency profiles, and profile synchronization will be implemented following design approval.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      <BottomNavigation activeTab="settings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 96,
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  card: {
    padding: 18,
    gap: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  noticeCard: {
    padding: 16,
  },
  noticeHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  noticeIcon: {
    fontSize: 20,
  },
  noticeTextCol: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  noticeDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
  nativeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
