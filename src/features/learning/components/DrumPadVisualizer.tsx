/**
 * DrumPadVisualizer
 *
 * Interactive tactile drum pad interface for Deaf and hard-of-hearing learners.
 * Features high-contrast, color-coded pads that actuate physical haptics immediately
 * on touch (Kick: Heavy thud, Snare: Sharp snap, Hi-Hat: Crisp tick).
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { theme } from '@/theme';
import { DrumType } from '../types';
import { playDrumHaptic } from '../useLearningSession';

interface DrumPadVisualizerProps {
  onPadPress?: (drum: DrumType, timestampMs: number) => void;
  disabled?: boolean;
}

interface PadConfig {
  drum: DrumType;
  title: string;
  role: string;
  tactileFeel: string;
  frequency: string;
  color: string;
}

const PADS: PadConfig[] = [
  {
    drum: 'kick',
    title: 'KICK',
    role: 'Downbeats (1 & 3)',
    tactileFeel: 'Heavy Deep Thud',
    frequency: '40–100 Hz',
    color: theme.colors.sensory.feel, // Rose #F43F5E
  },
  {
    drum: 'snare',
    title: 'SNARE',
    role: 'Backbeats (2 & 4)',
    tactileFeel: 'Sharp Snappy Crack',
    frequency: '200–800 Hz',
    color: theme.colors.sensory.see, // Violet #A855F7
  },
  {
    drum: 'hihat',
    title: 'HI-HAT',
    role: 'Eighth-Note Grid',
    tactileFeel: 'Crisp Micro-Tick',
    frequency: '5–12 kHz',
    color: theme.colors.sensory.read, // Cyan #38BDF8
  },
];

export const DrumPadVisualizer: React.FC<DrumPadVisualizerProps> = ({
  onPadPress,
  disabled = false,
}) => {
  const [activePad, setActivePad] = useState<DrumType | null>(null);
  const [tapCounts, setTapCounts] = useState<Record<DrumType, number>>({
    kick: 0,
    snare: 0,
    hihat: 0,
    uncertain: 0,
  });

  const handlePress = async (drum: DrumType) => {
    if (disabled) return;
    const now = Date.now();
    setActivePad(drum);
    setTapCounts((prev) => ({ ...prev, [drum]: prev[drum] + 1 }));

    // Immediate physical actuation
    await playDrumHaptic(drum);

    if (onPadPress) {
      onPadPress(drum, now);
    }

    setTimeout(() => {
      setActivePad((curr) => (curr === drum ? null : curr));
    }, 150);
  };

  return (
    <View style={styles.container}>
      <View style={styles.padsRow}>
        {PADS.map((pad) => {
          const isActive = activePad === pad.drum;
          const count = tapCounts[pad.drum];

          return (
            <Pressable
              key={pad.drum}
              onPressIn={() => handlePress(pad.drum)}
              disabled={disabled}
              style={[
                styles.pad,
                {
                  borderColor: pad.color,
                  backgroundColor: isActive
                    ? `${pad.color}33` // 20% opacity highlight
                    : theme.colors.background.surface,
                  transform: [{ scale: isActive ? 0.96 : 1.0 }],
                },
              ]}
              accessibilityLabel={`${pad.title} Drum Pad. ${pad.role}. ${pad.tactileFeel}`}
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.colorIndicator,
                  { backgroundColor: pad.color },
                ]}
              />

              <Text style={[styles.padTitle, { color: pad.color }]}>
                {pad.title}
              </Text>
              <Text style={styles.padRole}>{pad.role}</Text>

              <View style={styles.tactileBadge}>
                <Text style={styles.tactileText}>⚡ {pad.tactileFeel}</Text>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.freqText}>{pad.frequency}</Text>
                {count > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  padsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  pad: {
    flex: 1,
    minHeight: 140,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    padding: theme.spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  colorIndicator: {
    width: 24,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  padTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.heavy,
    letterSpacing: 1,
  },
  padRole: {
    fontSize: 10,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
  },
  tactileBadge: {
    backgroundColor: theme.colors.background.elevated,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    marginVertical: 4,
  },
  tactileText: {
    fontSize: 9,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  freqText: {
    fontSize: 9,
    color: theme.colors.text.muted,
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: theme.colors.background.highlight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.full,
  },
  countText: {
    fontSize: 10,
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
});
