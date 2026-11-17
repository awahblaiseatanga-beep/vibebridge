/**
 * VisualRhythmSurface (SEE Pillar)
 *
 * Hybrid visual rhythm surface communicating musical energy and timing through:
 * - Layer A (Expressive): Expanding, pulsating geometric nodes and energy rings
 * - Layer B (Informational): Secondary 4/4 beat meter, bar progression, and semantic labels
 *
 * Accessible by design: does not rely on color alone (uses distinct shapes, glyphs,
 * size, border weights, and text), and supports an explicit Reduced Motion mode.
 */

import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { theme } from '@/theme';
import { Card } from '@/components/common';
import { useVisualizer } from '../useVisualizer';

export const VisualRhythmSurface: React.FC = () => {
  const {
    state,
    enabled,
    reducedMotion,
    toggleEnabled,
    toggleReducedMotion,
  } = useVisualizer();

  const scaleAnim = useRef(new Animated.Value(1.0)).current;
  const opacityAnim = useRef(new Animated.Value(0.35)).current;
  const auraScaleAnim = useRef(new Animated.Value(1.0)).current;

  // React to visual cue transitions
  useEffect(() => {
    if (!enabled || state.isPaused || state.isBuffering || state.isRest) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(auraScaleAnim, {
          toValue: 1.0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (reducedMotion) {
      // Reduced motion: suppress large scale expansions, pulse opacity and border cleanly
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1.0,
            duration: 40,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: state.visual.opacity,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // Expressive motion: spring on strong beats, fast snap on subdivisions
      const targetScale = state.visual.scale;
      const auraTarget = 1.0 + (state.visual.energy * 0.45);

      if (state.intensityLevel === 'strong' || state.intensityLevel === 'accent') {
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: targetScale,
              duration: 45,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
            Animated.spring(scaleAnim, {
              toValue: 1.0,
              friction: 4,
              tension: 90,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(auraScaleAnim, {
              toValue: auraTarget,
              duration: 60,
              useNativeDriver: true,
            }),
            Animated.timing(auraScaleAnim, {
              toValue: 1.0,
              duration: 240,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 1.0,
              duration: 30,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.45,
              duration: 220,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      } else {
        // Soft beat / subdivision: rapid, gentle pulse
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: targetScale,
              duration: 35,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.0,
              duration: 160,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: state.visual.opacity,
              duration: 35,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.4,
              duration: 160,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      }
    }
  }, [state.totalEventsReceived, state.isPaused, state.isBuffering, state.isRest, enabled, reducedMotion]);

  // Determine active quarter-note beat (1 to 4) for the informational HUD
  const activeBeatQuarter = Math.floor(state.currentBeat);

  const getStatusText = (): string => {
    if (!enabled) return 'Visualizer Muted';
    if (state.isBuffering) return '⏳ Buffering Audio...';
    if (state.isPaused) return '⏸ Playback Paused';
    if (state.isRest) return '🛡️ Musical Rest';
    return state.visual.label;
  };

  return (
    <Card style={styles.card} variant="elevated">
      {/* Header with Title and Control Toggles */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.indicatorDot} />
          <Text style={styles.cardTitle}>SEE — Visual Rhythm</Text>
        </View>

        <View style={styles.controlsGroup}>
          {/* Reduced Motion Toggle */}
          <TouchableOpacity
            style={[styles.smallToggle, reducedMotion && styles.smallToggleActive]}
            onPress={toggleReducedMotion}
            activeOpacity={0.7}
            accessibilityRole="switch"
            accessibilityLabel={`Reduced motion is currently ${reducedMotion ? 'enabled' : 'disabled'}`}
          >
            <Text style={[styles.smallToggleText, reducedMotion && styles.smallToggleTextActive]}>
              {reducedMotion ? 'CALM' : 'MOTION'}
            </Text>
          </TouchableOpacity>

          {/* Master Enable/Disable Toggle */}
          <TouchableOpacity
            style={[styles.toggleButton, enabled ? styles.toggleActive : styles.toggleInactive]}
            onPress={toggleEnabled}
            activeOpacity={0.8}
            accessibilityRole="switch"
            accessibilityLabel={`Visual rhythm engine is currently ${enabled ? 'enabled' : 'disabled'}`}
          >
            <Text style={[styles.toggleText, enabled ? styles.toggleTextActive : styles.toggleTextInactive]}>
              {enabled ? 'ON' : 'MUTED'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Primary Expressive Visual Surface (Layer A) */}
      <View style={styles.visualCanvas}>
        {/* Outer Pulsing Energy Aura Ring */}
        <Animated.View
          style={[
            styles.energyAuraRing,
            {
              borderColor: enabled ? state.visual.color : theme.colors.text.muted,
              transform: [{ scale: auraScaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        />

        {/* Central Geometric Node */}
        <Animated.View
          style={[
            styles.centralNode,
            {
              borderColor: enabled ? state.visual.color : theme.colors.border.subtle,
              borderWidth: state.visual.borderWidth,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Non-color geometric glyph */}
          <Text
            style={[
              styles.glyphSymbol,
              { color: enabled ? state.visual.color : theme.colors.text.muted },
            ]}
          >
            {enabled ? state.visual.symbol : '—'}
          </Text>
        </Animated.View>
      </View>

      {/* Secondary Informational Meter (Layer B) */}
      <View style={styles.informationalContainer}>
        {/* 4/4 Beat Indicator HUD */}
        <View style={styles.beatMeterRow}>
          {[1, 2, 3, 4].map((beatNum) => {
            const isKick = beatNum === 1 || beatNum === 3;
            const isSnare = beatNum === 2 || beatNum === 4;
            const isActive = enabled && !state.isPaused && !state.isRest && activeBeatQuarter === beatNum;

            return (
              <View
                key={beatNum}
                style={[
                  styles.beatCell,
                  isActive && styles.beatCellActive,
                  isActive && { borderColor: isKick ? theme.colors.sensory.see : theme.colors.sensory.read },
                ]}
              >
                <Text style={[styles.beatCellGlyph, isActive && styles.beatCellGlyphActive]}>
                  {isKick ? '◆' : '▲'}
                </Text>
                <Text style={[styles.beatCellNumber, isActive && styles.beatCellNumberActive]}>
                  Beat {beatNum}
                </Text>
                <Text style={[styles.beatCellRole, isActive && styles.beatCellRoleActive]}>
                  {isKick ? 'Kick' : 'Snare'}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Measure & Status Summary Bar */}
        <View style={styles.statusRow}>
          <View style={styles.barBadge}>
            <Text style={styles.barBadgeText}>BAR {state.currentBar}/6</Text>
          </View>
          <Text style={styles.statusDescription} numberOfLines={1}>
            {getStatusText()}
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.sensory.see,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
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
    backgroundColor: theme.colors.sensory.see,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  controlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  smallToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  smallToggleActive: {
    borderColor: theme.colors.status.warning,
    backgroundColor: theme.colors.background.highlight,
  },
  smallToggleText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.muted,
  },
  smallToggleTextActive: {
    color: theme.colors.status.warning,
  },
  toggleButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  toggleActive: {
    backgroundColor: theme.colors.sensory.see,
    borderColor: theme.colors.sensory.see,
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

  // Layer A: Primary Expressive Surface
  visualCanvas: {
    height: 160,
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    marginBottom: theme.spacing.sm,
  },
  energyAuraRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
  },
  centralNode: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.background.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.sensory.see,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  glyphSymbol: {
    fontSize: 32,
    fontWeight: '800',
  },

  // Layer B: Secondary Informational Area
  informationalContainer: {
    backgroundColor: theme.colors.background.surface,
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  beatMeterRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  beatCell: {
    flex: 1,
    backgroundColor: theme.colors.background.base,
    paddingVertical: 4,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  beatCellActive: {
    backgroundColor: theme.colors.background.highlight,
    borderWidth: 1.5,
  },
  beatCellGlyph: {
    fontSize: 10,
    color: theme.colors.text.muted,
    marginBottom: 1,
  },
  beatCellGlyphActive: {
    color: theme.colors.text.primary,
  },
  beatCellNumber: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.muted,
  },
  beatCellNumberActive: {
    color: theme.colors.text.primary,
  },
  beatCellRole: {
    fontSize: 9,
    color: theme.colors.text.muted,
  },
  beatCellRoleActive: {
    color: theme.colors.sensory.see,
    fontWeight: theme.typography.weights.bold,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  barBadge: {
    backgroundColor: theme.colors.background.elevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  barBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.secondary,
  },
  statusDescription: {
    flex: 1,
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.medium,
  },
});
