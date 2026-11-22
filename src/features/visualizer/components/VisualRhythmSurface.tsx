/**
 * VisualRhythmSurface (SEE Pillar)
 *
 * Hybrid visual rhythm surface communicating musical energy and timing through:
 * - Layer A (Expressive): Expanding, pulsating geometric nodes and energy rings
 * - Layer B (Informational): Secondary 4/4 beat meter, bar progression, and semantic labels
 *
 * Accessible by design: does not rely on color alone (uses distinct shapes, glyphs,
 * size, border weights, and text), and supports an explicit Reduced Motion mode.
 *
 * Stage A.6 Decoupling Architecture:
 * - Layer A (VisualExpressiveCanvas): Memoized component isolated from React state updates.
 *   Directly subscribes to onVisualCue imperative animations with useNativeDriver: true.
 *   Uses stable fixed borderWidth and static layout geometry, completely eliminating
 *   Android requestLayout() passes during playback animations.
 * - Layer B (VisualInformationalHUD): Memoized component displaying low-frequency beat meter
 *   and bar progression without touching Layer A animation nodes.
 * - VisualHeader: Memoized controls for enabled/muted and reduced-motion mode.
 * - VisualCalibrationPanel: Memoized developer calibration panel updated at throttled low frequency.
 */

import React, { useEffect, useRef, useCallback } from 'react';
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
import {
  visualRhythmEngine,
  VisualCueAnimationPayload,
  VisualCueListener,
  VisualCalibrationOffset,
  VisualSyncTelemetryRecord,
  VISUAL_CALIBRATION_OFFSETS,
} from '@/engines/visual';
import { useVisualizer } from '../useVisualizer';

// ============================================================================
// 1. Subcomponent: VisualHeader (Memoized)
// ============================================================================

interface VisualHeaderProps {
  enabled: boolean;
  reducedMotion: boolean;
  onToggleEnabled: () => void;
  onToggleReducedMotion: () => void;
}

const VisualHeader = React.memo<VisualHeaderProps>(({
  enabled,
  reducedMotion,
  onToggleEnabled,
  onToggleReducedMotion,
}) => {
  return (
    <View style={styles.headerRow}>
      <View style={styles.titleGroup}>
        <View style={styles.indicatorDot} />
        <Text style={styles.cardTitle}>SEE — Visual Rhythm</Text>
      </View>

      <View style={styles.controlsGroup}>
        {/* Reduced Motion Toggle */}
        <TouchableOpacity
          style={[styles.smallToggle, reducedMotion && styles.smallToggleActive]}
          onPress={onToggleReducedMotion}
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
          onPress={onToggleEnabled}
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
  );
});
VisualHeader.displayName = 'VisualHeader';

// ============================================================================
// 2. Subcomponent: VisualExpressiveCanvas (Layer A - Memoized & Decoupled)
// ============================================================================

interface VisualExpressiveCanvasProps {
  enabled: boolean;
  reducedMotion: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  isRest: boolean;
  onVisualCue: (listener: VisualCueListener) => () => void;
}

const VisualExpressiveCanvas = React.memo<VisualExpressiveCanvasProps>(({
  enabled,
  reducedMotion,
  isPaused,
  isBuffering,
  isRest,
  onVisualCue,
}) => {
  // Stage A.7.2.2: Seven Persistent Native Animated Values
  // Layer 1: Core Node (Kinetic Impact & Directional Deformation)
  const coreScaleX = useRef(new Animated.Value(1.0)).current;
  const coreScaleY = useRef(new Animated.Value(1.0)).current;
  const coreOpacity = useRef(new Animated.Value(0.35)).current;

  // Layer 2: Energy Field (Ambient Breath & Continuous Motion)
  const fieldScale = useRef(new Animated.Value(1.05)).current;
  const fieldOpacity = useRef(new Animated.Value(0.25)).current;

  // Layer 3: Acoustic Aura / Ripple (Accent Wave Propagation)
  const rippleScale = useRef(new Animated.Value(1.0)).current;
  const rippleOpacity = useRef(new Animated.Value(0.0)).current;

  // Dedicated Active Animation References
  const activeCoreAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const activeFieldAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const activeRippleAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const activeSettleAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // 1. Direct imperative animation listener: triggers immediately on incoming scheduled visual events,
  // completely bypassing the React render, reconciliation, and commit cycle.
  useEffect(() => {
    const unsubscribeCue = onVisualCue((cue) => {
      if (!enabled) return;

      // Stage A.7.2.3.10: Immediately cancel any running settle animation
      // to prevent it from competing with or delaying incoming visual cues
      if (activeSettleAnimRef.current) {
        activeSettleAnimRef.current.stop();
        activeSettleAnimRef.current = null;
      }

      // ----------------------------------------------------------------------
      // LAYER 1: CORE NODE (Kinetic Impact & Directional Deformation)
      // ----------------------------------------------------------------------
      if (activeCoreAnimRef.current) {
        activeCoreAnimRef.current.stop();
        activeCoreAnimRef.current = null;
      }

      let coreAnim: Animated.CompositeAnimation;
      if (cue.reducedMotion) {
        // Reduced motion: All scale locked strictly to 1.0 (no kinetic movement)
        // High-contrast opacity pulse provides non-motion rhythm clarity
        const opacityTarget = cue.visual.opacity;
        coreAnim = Animated.parallel([
          Animated.timing(coreScaleX, { toValue: 1.0, duration: 30, useNativeDriver: true }),
          Animated.timing(coreScaleY, { toValue: 1.0, duration: 30, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(coreOpacity, {
              toValue: Math.min(1.0, opacityTarget + 0.3),
              duration: cue.attackMs,
              useNativeDriver: true,
            }),
            Animated.timing(coreOpacity, {
              toValue: 0.35,
              duration: cue.decayMs,
              useNativeDriver: true,
            }),
          ]),
        ]);
      } else {
        // Directional deformation: downbeat horizontal squash, backbeat vertical snap, accent burst
        coreAnim = Animated.parallel([
          // ScaleX attack & decay
          Animated.sequence([
            Animated.timing(coreScaleX, {
              toValue: cue.targetScaleX,
              duration: cue.attackMs,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
            Animated.timing(coreScaleX, {
              toValue: 1.0,
              duration: cue.decayMs,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
          ]),
          // ScaleY attack & decay
          Animated.sequence([
            Animated.timing(coreScaleY, {
              toValue: cue.targetScaleY,
              duration: cue.attackMs,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
            Animated.timing(coreScaleY, {
              toValue: 1.0,
              duration: cue.decayMs,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
          ]),
          // Opacity flare & decay
          Animated.sequence([
            Animated.timing(coreOpacity, {
              toValue: Math.min(1.0, cue.visual.opacity + 0.2),
              duration: Math.max(15, cue.attackMs - 5),
              useNativeDriver: true,
            }),
            Animated.timing(coreOpacity, {
              toValue: 0.35,
              duration: cue.decayMs,
              useNativeDriver: true,
            }),
          ]),
        ]);
      }

      activeCoreAnimRef.current = coreAnim;
      coreAnim.start((res) => {
        if (res.finished) {
          activeCoreAnimRef.current = null;
        }
      });

      // ----------------------------------------------------------------------
      // LAYER 2: ENERGY FIELD (Continuous Ambient Motion & Breathing)
      // Retargets from current position on each cue without resetting to zero
      // ----------------------------------------------------------------------
      if (activeFieldAnimRef.current) {
        activeFieldAnimRef.current.stop();
        activeFieldAnimRef.current = null;
      }

      let fieldAnim: Animated.CompositeAnimation;
      if (cue.reducedMotion) {
        // Reduced motion: Field scale locked to 1.0, opacity pulses with field energy
        fieldAnim = Animated.parallel([
          Animated.timing(fieldScale, { toValue: 1.0, duration: 30, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(fieldOpacity, {
              toValue: cue.targetFieldOpacity,
              duration: 50,
              useNativeDriver: true,
            }),
            Animated.timing(fieldOpacity, {
              toValue: 0.25,
              duration: 450,
              useNativeDriver: true,
            }),
          ]),
        ]);
      } else {
        // Continuous ambient breathing: ramps up over 50ms, decays over ~450ms toward ambient floor (1.05x scale, 0.25 opacity)
        fieldAnim = Animated.sequence([
          Animated.parallel([
            Animated.timing(fieldScale, {
              toValue: cue.targetFieldScale,
              duration: 50,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
            Animated.timing(fieldOpacity, {
              toValue: cue.targetFieldOpacity,
              duration: 50,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(fieldScale, {
              toValue: 1.05,
              duration: 450,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
            Animated.timing(fieldOpacity, {
              toValue: 0.25,
              duration: 450,
              useNativeDriver: true,
              easing: Easing.out(Easing.quad),
            }),
          ]),
        ]);
      }

      activeFieldAnimRef.current = fieldAnim;
      fieldAnim.start((res) => {
        if (res.finished) {
          activeFieldAnimRef.current = null;
        }
      });

      // ----------------------------------------------------------------------
      // LAYER 3: ACOUSTIC AURA / RIPPLE (Major Accents & Resolution Only)
      // Ordinary downbeats and backbeats NEVER stop, restart, or interfere with an active Ripple!
      // ----------------------------------------------------------------------
      if (cue.triggerRipple && !cue.reducedMotion) {
        if (activeRippleAnimRef.current) {
          activeRippleAnimRef.current.stop();
          activeRippleAnimRef.current = null;
        }

        rippleScale.setValue(1.0);
        rippleOpacity.setValue(cue.targetRippleOpacity);

        const rippleAnim = Animated.parallel([
          Animated.timing(rippleScale, {
            toValue: cue.targetRippleScale,
            duration: cue.rippleDurationMs,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.timing(rippleOpacity, {
            toValue: 0.0,
            duration: cue.rippleDurationMs,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
        ]);

        activeRippleAnimRef.current = rippleAnim;
        rippleAnim.start((res) => {
          if (res.finished) {
            activeRippleAnimRef.current = null;
          }
        });
      }

      // Record exact animation initiation timestamp for visual sync telemetry
      visualRhythmEngine.recordAnimationInitiated(cue.event.id);
    });

    return () => {
      unsubscribeCue();
      if (activeCoreAnimRef.current) {
        activeCoreAnimRef.current.stop();
        activeCoreAnimRef.current = null;
      }
      if (activeFieldAnimRef.current) {
        activeFieldAnimRef.current.stop();
        activeFieldAnimRef.current = null;
      }
      if (activeRippleAnimRef.current) {
        activeRippleAnimRef.current.stop();
        activeRippleAnimRef.current = null;
      }
      if (activeSettleAnimRef.current) {
        activeSettleAnimRef.current.stop();
        activeSettleAnimRef.current = null;
      }
    };
  }, [
    enabled,
    onVisualCue,
    coreScaleX,
    coreScaleY,
    coreOpacity,
    fieldScale,
    fieldOpacity,
    rippleScale,
    rippleOpacity,
  ]);

  // 2. Settle to calm resting baseline when transport is inactive, paused, buffering, or resting.
  // Stage A.7.1.2 & Stage A.7.2.2 Lifecycle Guarantees:
  // - Genuine transport interruptions (mute, pause, buffering) MUST forcibly stop active animations.
  // - Musical rest (isRest during active playback) MUST NOT interrupt an active cue animation mid-flight.
  useEffect(() => {
    // A genuine transport interruption (mute, pause, buffering) immediately freezes and settles active animations:
    if (!enabled || isPaused || isBuffering) {
      if (activeCoreAnimRef.current) {
        activeCoreAnimRef.current.stop();
        activeCoreAnimRef.current = null;
      }
      if (activeFieldAnimRef.current) {
        activeFieldAnimRef.current.stop();
        activeFieldAnimRef.current = null;
      }
      if (activeRippleAnimRef.current) {
        activeRippleAnimRef.current.stop();
        activeRippleAnimRef.current = null;
      }

      const settleAnim = Animated.parallel([
        Animated.timing(coreScaleX, {
          toValue: 1.0,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(coreScaleY, {
          toValue: 1.0,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(coreOpacity, {
          toValue: 0.35,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fieldScale, {
          toValue: enabled ? 1.05 : 1.0,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(fieldOpacity, {
          toValue: 0.25,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(rippleScale, {
          toValue: 1.0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0.0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]);

      if (activeSettleAnimRef.current) {
        activeSettleAnimRef.current.stop();
        activeSettleAnimRef.current = null;
      }
      activeSettleAnimRef.current = settleAnim;
      settleAnim.start((res) => {
        if (res.finished) {
          activeSettleAnimRef.current = null;
        }
      });
      return;
    }

    // Active musical rest (e.g. post-resolution silence at 11800ms-12000ms):
    // Only settle if no cue animation is actively running.
    // Never interrupt an active cue animation (such as Beat 1 or Final Resolution) mid-flight!
    if (isRest) {
      if (!activeCoreAnimRef.current && !activeFieldAnimRef.current && !activeRippleAnimRef.current) {
        const settleAnim = Animated.parallel([
          Animated.timing(coreScaleX, {
            toValue: 1.0,
            duration: 150,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(coreScaleY, {
            toValue: 1.0,
            duration: 150,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(coreOpacity, {
            toValue: 0.35,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(fieldScale, {
            toValue: 1.05,
            duration: 150,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(fieldOpacity, {
            toValue: 0.25,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(rippleScale, {
            toValue: 1.0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(rippleOpacity, {
            toValue: 0.0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]);

        if (activeSettleAnimRef.current) {
          activeSettleAnimRef.current.stop();
          activeSettleAnimRef.current = null;
        }
        activeSettleAnimRef.current = settleAnim;
        settleAnim.start((res) => {
          if (res.finished) {
            activeSettleAnimRef.current = null;
          }
        });
      }
    }

    return () => {
      if (activeSettleAnimRef.current) {
        activeSettleAnimRef.current.stop();
        activeSettleAnimRef.current = null;
      }
    };
  }, [
    isPaused,
    isBuffering,
    isRest,
    enabled,
    coreScaleX,
    coreScaleY,
    coreOpacity,
    fieldScale,
    fieldOpacity,
    rippleScale,
    rippleOpacity,
  ]);

  const glyphText = !enabled
    ? '—'
    : isPaused
    ? '⏸'
    : isBuffering
    ? '⏳'
    : isRest
    ? '—'
    : '◆';

  return (
    <View style={styles.visualCanvas}>
      {/* Layer 3: Acoustic Aura / Ripple (Wave Propagation) */}
      <Animated.View
        style={[
          styles.rippleRing,
          {
            borderColor: enabled ? theme.colors.status.warning : theme.colors.border.subtle,
            transform: [{ scale: rippleScale }],
            opacity: rippleOpacity,
          },
        ]}
      />

      {/* Layer 2: Energy Field (Ambient Breath & Continuous Motion) */}
      <Animated.View
        style={[
          styles.energyFieldRing,
          {
            borderColor: enabled ? theme.colors.sensory.see : theme.colors.border.subtle,
            transform: [{ scale: fieldScale }],
            opacity: fieldOpacity,
          },
        ]}
      />

      {/* Layer 1: Central Core Node (Directional Kinetic Impact) */}
      <Animated.View
        style={[
          styles.centralNode,
          {
            borderColor: enabled ? theme.colors.sensory.see : theme.colors.border.subtle,
            borderWidth: 3,
            transform: [{ scaleX: coreScaleX }, { scaleY: coreScaleY }],
          },
        ]}
      >
        {/* Non-color geometric glyph */}
        <Text
          style={[
            styles.glyphSymbol,
            { color: enabled ? theme.colors.sensory.see : theme.colors.text.muted },
          ]}
        >
          {glyphText}
        </Text>
      </Animated.View>
    </View>
  );
});
VisualExpressiveCanvas.displayName = 'VisualExpressiveCanvas';

// ============================================================================
// 3. Subcomponent: VisualInformationalHUD (Layer B - Memoized)
// ============================================================================

interface VisualInformationalHUDProps {
  enabled: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  isRest: boolean;
  currentBar: number;
  currentBeat: number;
  statusText: string;
}

const VisualInformationalHUD = React.memo<VisualInformationalHUDProps>(({
  enabled,
  isPaused,
  isBuffering,
  isRest,
  currentBar,
  currentBeat,
  statusText,
}) => {
  const activeBeatQuarter = Math.floor(currentBeat);

  return (
    <View style={styles.informationalContainer}>
      {/* 4/4 Beat Indicator HUD */}
      <View style={styles.beatMeterRow}>
        {[1, 2, 3, 4].map((beatNum) => {
          const isKick = beatNum === 1 || beatNum === 3;
          const isSnare = beatNum === 2 || beatNum === 4;
          const isActive = enabled && !isPaused && !isRest && activeBeatQuarter === beatNum;

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
          <Text style={styles.barBadgeText}>BAR {currentBar}/6</Text>
        </View>
        <Text style={styles.statusDescription} numberOfLines={1}>
          {statusText}
        </Text>
      </View>
    </View>
  );
});
VisualInformationalHUD.displayName = 'VisualInformationalHUD';

// ============================================================================
// 4. Subcomponent: VisualCalibrationPanel (Memoized)
// ============================================================================

interface VisualCalibrationPanelProps {
  visualOffset: VisualCalibrationOffset;
  latestTelemetry: VisualSyncTelemetryRecord | null;
  onSelectOffset: (offset: VisualCalibrationOffset) => void;
}

const VisualCalibrationPanel = React.memo<VisualCalibrationPanelProps>(({
  visualOffset,
  latestTelemetry,
  onSelectOffset,
}) => {
  return (
    <View style={styles.calibrationContainer}>
      <View style={styles.calibrationHeader}>
        <Text style={styles.calibrationTitle}>SEE LATENCY LEAD (CALIBRATION)</Text>
        {latestTelemetry && (
          <Text style={styles.telemetryText}>
            lead:{latestTelemetry.selectedVisualOffsetMs}ms | setup:{latestTelemetry.setupLatencyMs.toFixed(1)}ms
          </Text>
        )}
      </View>
      <View style={styles.calibrationPillsRow}>
        {VISUAL_CALIBRATION_OFFSETS.map((offset) => {
          const isSelected = visualOffset === offset;
          return (
            <TouchableOpacity
              key={offset}
              style={[
                styles.calibrationPill,
                isSelected && styles.calibrationPillSelected,
              ]}
              onPress={() => onSelectOffset(offset)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Set visual latency lead to ${offset} milliseconds`}
            >
              <Text
                style={[
                  styles.calibrationPillText,
                  isSelected && styles.calibrationPillTextSelected,
                ]}
              >
                {offset === 16 ? '16ms (Default)' : `${offset}ms`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});
VisualCalibrationPanel.displayName = 'VisualCalibrationPanel';

// ============================================================================
// 5. Root Component: VisualRhythmSurface
// ============================================================================

export const VisualRhythmSurface: React.FC = () => {
  const {
    state,
    enabled,
    reducedMotion,
    visualOffset,
    latestTelemetry,
    toggleEnabled,
    toggleReducedMotion,
    setVisualOffset,
    onVisualCue,
  } = useVisualizer();

  const getStatusText = useCallback((): string => {
    if (!enabled) return 'Visualizer Muted';
    if (state.isBuffering) return '⏳ Buffering Audio...';
    if (state.isPaused) return '⏸ Playback Paused';
    if (state.isRest) return '🛡️ Musical Rest';
    return state.visual.label;
  }, [enabled, state.isBuffering, state.isPaused, state.isRest, state.visual.label]);

  return (
    <Card style={styles.card} variant="elevated">
      {/* Header with Title and Control Toggles */}
      <VisualHeader
        enabled={enabled}
        reducedMotion={reducedMotion}
        onToggleEnabled={toggleEnabled}
        onToggleReducedMotion={toggleReducedMotion}
      />

      {/* Primary Expressive Visual Surface (Layer A) */}
      <VisualExpressiveCanvas
        enabled={enabled}
        reducedMotion={reducedMotion}
        isPaused={state.isPaused}
        isBuffering={state.isBuffering}
        isRest={state.isRest}
        onVisualCue={onVisualCue}
      />

      {/* Secondary Informational Meter (Layer B) */}
      <VisualInformationalHUD
        enabled={enabled}
        isPaused={state.isPaused}
        isBuffering={state.isBuffering}
        isRest={state.isRest}
        currentBar={state.currentBar}
        currentBeat={state.currentBeat}
        statusText={getStatusText()}
      />

      {/* Dev-only Controlled Visual Latency Lead Calibration Panel */}
      <VisualCalibrationPanel
        visualOffset={visualOffset}
        latestTelemetry={latestTelemetry}
        onSelectOffset={setVisualOffset}
      />
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
  rippleRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
  },
  energyFieldRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
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

  // Dev-only Controlled Visual Latency Lead Calibration Panel
  calibrationContainer: {
    marginTop: theme.spacing.xs,
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  calibrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  calibrationTitle: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.sensory.see,
    letterSpacing: 0.5,
  },
  telemetryText: {
    fontSize: 9,
    color: theme.colors.text.muted,
  },
  calibrationPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  calibrationPill: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  calibrationPillSelected: {
    backgroundColor: theme.colors.sensory.see,
    borderColor: theme.colors.sensory.see,
  },
  calibrationPillText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.secondary,
  },
  calibrationPillTextSelected: {
    color: '#000000',
    fontWeight: theme.typography.weights.bold,
  },
});
