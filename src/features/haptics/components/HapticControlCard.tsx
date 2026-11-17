/**
 * HapticControlCard (FEEL Pillar)
 *
 * User-facing control panel for tactile haptics:
 * - Master Enable/Disable toggle
 * - Intensity level selection (25%, 50%, 75%, 100%)
 * - Live beat visualizer indicator (reacts when haptics fire)
 * - Test vibration buttons
 * - Motor protection & Android hardware notice
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { theme } from '@/theme';
import { Card } from '@/components/common';
import { useHaptics } from '../useHaptics';
import { HapticPattern } from '@/engines/haptic';

const INTENSITY_PRESETS = [
  { label: '25%', value: 0.25, description: 'Gentle' },
  { label: '50%', value: 0.5, description: 'Balanced' },
  { label: '75%', value: 0.75, description: 'Strong' },
  { label: '100%', value: 1.0, description: 'Max' },
];

export const HapticControlCard: React.FC = () => {
  const {
    enabled,
    intensity,
    lastPattern,
    toggleEnabled,
    setIntensity,
    triggerTest,
  } = useHaptics();

  const getPatternDisplay = (pattern: HapticPattern | null): { text: string; color: string } => {
    if (!pattern || pattern === 'silence') return { text: 'Idle', color: theme.colors.text.muted };
    switch (pattern) {
      case 'heavy':
        return { text: '⚡ DOWNBEAT KICK (Heavy)', color: theme.colors.sensory.feel };
      case 'medium':
        return { text: '🥁 BACKBEAT SNARE (Medium)', color: theme.colors.sensory.read };
      case 'light':
        return { text: '🎵 SUBDIVISION (Light)', color: theme.colors.sensory.see };
      case 'rigid':
        return { text: '✨ ACCENT HIT (Rigid)', color: theme.colors.status.warning };
      case 'pulse':
        return { text: '🌟 RESOLUTION (Pulse)', color: theme.colors.status.success };
      default:
        return { text: pattern.toUpperCase(), color: theme.colors.text.primary };
    }
  };

  const patternInfo = getPatternDisplay(lastPattern);

  return (
    <Card style={styles.card} variant="elevated">
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.indicatorDot} />
          <Text style={styles.cardTitle}>FEEL — Tactile Haptics</Text>
        </View>

        {/* Master Toggle */}
        <TouchableOpacity
          style={[styles.toggleButton, enabled ? styles.toggleActive : styles.toggleInactive]}
          onPress={toggleEnabled}
          activeOpacity={0.8}
          accessibilityRole="switch"
          accessibilityLabel={`Tactile feedback is currently ${enabled ? 'enabled' : 'disabled'}`}
        >
          <Text style={[styles.toggleText, enabled ? styles.toggleTextActive : styles.toggleTextInactive]}>
            {enabled ? 'ON' : 'MUTED'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.cardSubtitle}>
        Vibrates phone motor in real-time sync with musical downbeats, snares, and rhythm subdivisions.
      </Text>

      {/* Live Sensory Feedback Indicator */}
      <View style={styles.feedbackContainer}>
        <Text style={styles.feedbackLabel}>Live Actuator Status</Text>
        <View style={styles.feedbackValueRow}>
          <View style={[styles.feedbackGlow, { backgroundColor: enabled ? patternInfo.color : theme.colors.text.muted }]} />
          <Text style={[styles.feedbackValue, { color: enabled ? patternInfo.color : theme.colors.text.muted }]}>
            {enabled ? patternInfo.text : 'Haptics Muted by User'}
          </Text>
        </View>
      </View>

      {/* Intensity Selector */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Tactile Intensity</Text>
          <Text style={styles.intensityPercentText}>{Math.round(intensity * 100)}%</Text>
        </View>
        <Text style={styles.sectionNotice}>
          Logical intensity levels mapped to Expo Haptics styles. Does not represent physical motor amplitude percentages.
        </Text>

        <View style={styles.presetRow}>
          {INTENSITY_PRESETS.map((preset) => {
            const isSelected = Math.abs(intensity - preset.value) < 0.05;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.presetButton,
                  isSelected && styles.presetButtonActive,
                  !enabled && styles.presetButtonDisabled,
                ]}
                onPress={() => setIntensity(preset.value)}
                disabled={!enabled}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.presetLabel,
                    isSelected && styles.presetLabelActive,
                    !enabled && styles.presetLabelDisabled,
                  ]}
                >
                  {preset.label}
                </Text>
                <Text
                  style={[
                    styles.presetDesc,
                    isSelected && styles.presetDescActive,
                    !enabled && styles.presetDescDisabled,
                  ]}
                >
                  {preset.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Quick Test Vibration Buttons */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Feel Test Patterns</Text>
        <View style={styles.testButtonsRow}>
          <TouchableOpacity
            style={[styles.testButton, !enabled && styles.testButtonDisabled]}
            onPress={() => triggerTest('heavy')}
            disabled={!enabled}
            activeOpacity={0.7}
          >
            <Text style={styles.testButtonText}>Kick (Heavy)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, !enabled && styles.testButtonDisabled]}
            onPress={() => triggerTest('medium')}
            disabled={!enabled}
            activeOpacity={0.7}
          >
            <Text style={styles.testButtonText}>Snare (Med)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, !enabled && styles.testButtonDisabled]}
            onPress={() => triggerTest('light')}
            disabled={!enabled}
            activeOpacity={0.7}
          >
            <Text style={styles.testButtonText}>Hi-Hat (Light)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, !enabled && styles.testButtonDisabled]}
            onPress={() => triggerTest('pulse')}
            disabled={!enabled}
            activeOpacity={0.7}
          >
            <Text style={styles.testButtonText}>Pulse</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Android Hardware & Safeguards Notice */}
      <View style={styles.safeguardBanner}>
        <Text style={styles.safeguardText}>
          🛡️ <Text style={styles.safeguardBold}>Event-Rate Safeguard:</Text> 40ms minimum trigger interval active. Actual tactile response varies by Android motor hardware (LRA vs ERM) and device driver implementation.
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.sensory.feel,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.sensory.feel,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  cardSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  },
  toggleButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  toggleActive: {
    backgroundColor: theme.colors.sensory.feel,
    borderColor: theme.colors.sensory.feel,
  },
  toggleInactive: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.subtle,
  },
  toggleText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  toggleTextActive: {
    color: '#000000',
  },
  toggleTextInactive: {
    color: theme.colors.text.muted,
  },
  feedbackContainer: {
    backgroundColor: theme.colors.background.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  feedbackLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  feedbackValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  feedbackGlow: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  feedbackValue: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  sectionContainer: {
    marginBottom: theme.spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
  },
  sectionNotice: {
    fontSize: 11,
    color: theme.colors.text.muted,
    marginBottom: theme.spacing.xs,
    lineHeight: 14,
  },
  intensityPercentText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.sensory.feel,
  },
  presetRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  presetButton: {
    flex: 1,
    backgroundColor: theme.colors.background.surface,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 4,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  presetButtonActive: {
    backgroundColor: theme.colors.sensory.feel + '22',
    borderColor: theme.colors.sensory.feel,
  },
  presetButtonDisabled: {
    opacity: 0.4,
  },
  presetLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.secondary,
  },
  presetLabelActive: {
    color: theme.colors.sensory.feel,
  },
  presetLabelDisabled: {
    color: theme.colors.text.muted,
  },
  presetDesc: {
    fontSize: 10,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  presetDescActive: {
    color: theme.colors.text.primary,
  },
  presetDescDisabled: {
    color: theme.colors.text.muted,
  },
  testButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  testButton: {
    flex: 1,
    backgroundColor: theme.colors.background.surface,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  testButtonDisabled: {
    opacity: 0.4,
  },
  testButtonText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.secondary,
  },
  safeguardBanner: {
    backgroundColor: theme.colors.background.base,
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  safeguardText: {
    fontSize: 11,
    color: theme.colors.text.muted,
    lineHeight: 15,
  },
  safeguardBold: {
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.bold,
  },
});
