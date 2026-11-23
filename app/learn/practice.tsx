import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme';
import { Card, Button } from '@/components/common';
import { useLearningSession } from '@/features/learning';

export default function PhysicalPracticeStudioScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activePattern, clearPracticeTaps, evaluateSession } = useLearningSession();

  const [isPracticing, setIsPracticing] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(1);
  const [currentMeasure, setCurrentMeasure] = useState(1);
  const [micLevel, setMicLevel] = useState(0.45);
  const [detectedHit, setDetectedHit] = useState<string | null>(null);

  // Visual pulse animation for acoustic hits (zero haptic vibration!)
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Visual metronome loop during practice (visual only!)
  useEffect(() => {
    if (!isPracticing) return;

    const interval = setInterval(() => {
      setCurrentBeat((prevBeat) => {
        const nextBeat = (prevBeat % 4) + 1;
        if (nextBeat === 1) {
          setCurrentMeasure((prevMeasure) => (prevMeasure % 4) + 1);
        }

        // Simulate real-time acoustic transient capture during take
        const hitType = nextBeat === 1 || nextBeat === 3 ? 'kick' : 'snare';
        setDetectedHit(hitType);
        setMicLevel(0.75 + Math.random() * 0.2);

        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(flashAnim, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          }),
        ]).start();

        setTimeout(() => setDetectedHit(null), 150);

        return nextBeat;
      });
    }, 577); // ~104 BPM = ~577ms

    return () => clearInterval(interval);
  }, [isPracticing, flashAnim]);

  const handleStartStop = () => {
    if (isPracticing) {
      setIsPracticing(false);
      // Run evaluation and navigate to results
      evaluateSession();
      router.push('/learn/results');
    } else {
      clearPracticeTaps();
      setCurrentBeat(1);
      setCurrentMeasure(1);
      setIsPracticing(true);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      {/* 1. Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={[styles.backIcon, { color: colors.text.primary }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Physical Practice</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
            {activePattern ? activePattern.title : 'Rock Foundation Groove'} • 104 BPM
          </Text>
        </View>

        <View style={[styles.visualOnlyPill, { backgroundColor: 'rgba(21, 158, 152, 0.15)' }]}>
          <Text style={[styles.visualOnlyText, { color: colors.accent.secondary }]}>VISUAL ONLY</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Practice Notice: Visual Feedback Only */}
        <View style={[styles.noticeCard, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
          <Text style={styles.noticeIcon}>ℹ️</Text>
          <Text style={[styles.noticeText, { color: colors.text.secondary }]}>
            Phone haptics are suspended during physical acoustic practice to prevent distraction while you strike your physical drum kit. Feedback is entirely visual.
          </Text>
        </View>

        {/* 2. Microphone Sensor & Live Level Gauge */}
        <Card variant="surface" radius="large" style={styles.micCard}>
          <View style={styles.micHeaderRow}>
            <View style={styles.micHeaderLeft}>
              <View style={[styles.micIconBox, { backgroundColor: 'rgba(70, 87, 213, 0.15)' }]}>
                <Text style={{ fontSize: 18 }}>🎙️</Text>
              </View>
              <View>
                <Text style={[styles.micTitle, { color: colors.text.primary }]}>Acoustic Microphone Sensor</Text>
                <Text style={[styles.micSub, { color: colors.text.secondary }]}>
                  {isPracticing ? 'Analyzing acoustic drum attacks in real time' : 'Awaiting start of take'}
                </Text>
              </View>
            </View>
            <View style={[styles.micStatusBadge, { backgroundColor: isPracticing ? 'rgba(21, 158, 152, 0.15)' : colors.background.elevated }]}>
              <View style={[styles.dot, { backgroundColor: isPracticing ? colors.accent.secondary : colors.text.secondary }]} />
              <Text style={[styles.micStatusText, { color: isPracticing ? colors.accent.secondary : colors.text.secondary }]}>
                {isPracticing ? 'LISTENING' : 'STANDBY'}
              </Text>
            </View>
          </View>

          {/* Level Gauge */}
          <View style={[styles.gaugeTrack, { backgroundColor: colors.background.elevated }]}>
            <View
              style={[
                styles.gaugeFill,
                {
                  width: `${isPracticing ? Math.min(100, micLevel * 100) : 10}%`,
                  backgroundColor: colors.accent.secondary,
                },
              ]}
            />
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={[styles.gaugeText, { color: colors.text.secondary }]}>Noise Floor (-40dB)</Text>
            <Text style={[styles.gaugeText, { color: colors.text.secondary }]}>Transient Peak</Text>
          </View>
        </Card>

        {/* 3. Visual Rhythm Metronome & Measure Progress */}
        <Card variant="surface" radius="hero" style={styles.visualStudioCard}>
          <View style={styles.measureHeader}>
            <Text style={[styles.measureLabel, { color: colors.text.secondary }]}>MEASURE PROGRESS</Text>
            <Text style={[styles.measureValue, { color: colors.accent.primary }]}>
              Measure {currentMeasure} of 4 • 4/4
            </Text>
          </View>

          {/* Large Visual Pulse Node */}
          <View style={styles.pulseNodeBox}>
            <Animated.View
              style={[
                styles.transientGlowRing,
                {
                  borderColor: detectedHit === 'kick' ? colors.accent.primary : colors.accent.secondary,
                  opacity: flashAnim,
                  transform: [
                    {
                      scale: flashAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.25],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View
              style={[
                styles.centerTransientNode,
                {
                  backgroundColor: detectedHit ? (detectedHit === 'kick' ? colors.accent.primary : colors.accent.secondary) : colors.background.elevated,
                  borderColor: colors.border.subtle,
                },
              ]}
            >
              <Text style={[styles.nodeIconText, { color: detectedHit ? '#FFFFFF' : colors.text.secondary }]}>
                {detectedHit ? (detectedHit === 'kick' ? 'KICK' : 'SNARE') : 'GRID'}
              </Text>
            </View>
          </View>

          {/* 4-Beat Rhythmic Guide Dock */}
          <View style={styles.beatGuideRow}>
            {[
              { beat: 1, name: 'KICK', target: 'Beat 1' },
              { beat: 2, name: 'SNARE', target: 'Beat 2' },
              { beat: 3, name: 'KICK', target: 'Beat 3' },
              { beat: 4, name: 'SNARE', target: 'Beat 4' },
            ].map((item) => {
              const isCurrent = currentBeat === item.beat && isPracticing;
              return (
                <View
                  key={item.beat}
                  style={[
                    styles.beatGuidePill,
                    {
                      backgroundColor: isCurrent ? colors.accent.primary : colors.background.secondary,
                      borderColor: isCurrent ? colors.accent.secondary : colors.border.subtle,
                    },
                  ]}
                >
                  <Text style={[styles.beatNumber, { color: isCurrent ? '#FFFFFF' : colors.text.primary }]}>
                    B{item.beat}
                  </Text>
                  <Text style={[styles.beatInstName, { color: isCurrent ? 'rgba(255,255,255,0.85)' : colors.text.secondary }]}>
                    {item.name}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* 4. Controls */}
        <View style={styles.actionSection}>
          <Button
            label={isPracticing ? 'Finish Take & Evaluate Groove' : 'Start Acoustic Take'}
            onPress={handleStartStop}
            variant="primary"
            style={styles.mainActionBtn}
          />

          {isPracticing && (
            <Button
              label="Reset Take"
              onPress={() => {
                clearPracticeTaps();
                setCurrentBeat(1);
                setCurrentMeasure(1);
              }}
              variant="secondary"
              style={styles.resetBtn}
            />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  visualOnlyPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  visualOnlyText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  noticeIcon: {
    fontSize: 16,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  micCard: {
    padding: 16,
    marginBottom: 18,
  },
  micHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  micHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  micIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  micSub: {
    fontSize: 11,
    marginTop: 2,
  },
  micStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  micStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  gaugeTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  gaugeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  visualStudioCard: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  measureHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  measureLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  measureValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  pulseNodeBox: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 16,
  },
  transientGlowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
  },
  centerTransientNode: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  nodeIconText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  beatGuideRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 16,
  },
  beatGuidePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  beatNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  beatInstName: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  actionSection: {
    flexDirection: 'column',
    gap: 10,
  },
  mainActionBtn: {
    minHeight: 54,
  },
  resetBtn: {
    minHeight: 46,
  },
});
