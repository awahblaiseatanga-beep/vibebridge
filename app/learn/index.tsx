import React from 'react';
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
import { Card, Button, BottomNavigation } from '@/components/common';
import { useLearningSession } from '@/features/learning';

// Local verified image assets
const heroDrumImg = require('../../assets/images/lessons/rock-foundation-groove.jpg');
const rockGrooveThumb = require('../../assets/images/lessons/rock-foundation-groove.jpg');
const kickSnareThumb = require('../../assets/images/lessons/kick-snare-card.jpg');
const hiHatThumb = require('../../assets/images/lessons/hi-hat-fundamentals.jpg');
const drummerThumb = require('../../assets/images/demonstrations/professional-drummer.jpg');
const spheresArtwork = require('../../assets/images/player/spheres-album-art.png');

export default function AcademyHomeV2Screen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const { activePattern, lastEvaluation } = useLearningSession();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header: Back to Explore, Brand & Header Controls */}
        <View style={[styles.headerContainer, { borderBottomColor: colors.border.subtle }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backExploreBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
              onPress={() => router.push('/')}
              accessibilityLabel="Back to Explore Music"
              accessibilityRole="button"
            >
              <Text style={[styles.backExploreArrow, { color: colors.text.primary }]}>←</Text>
              <Text style={[styles.backExploreLabel, { color: colors.text.primary }]}>Explore</Text>
            </TouchableOpacity>

            <View style={styles.brandTextCol}>
              <View style={styles.brandTitleRow}>
                <View style={[styles.brandIconMini, { backgroundColor: colors.accent.primary }]}>
                  <Text style={styles.brandIconText}>🥁</Text>
                </View>
                <Text style={[styles.brandSuperTitle, { color: colors.accent.primary }]}>VIBEBRIDGE ACADEMY</Text>
              </View>
              <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Welcome back</Text>
              <Text style={[styles.headerSub, { color: colors.text.secondary }]}>Ready to feel the rhythm?</Text>
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

        {/* 2. Primary Feature Card: Learn to Play Music (V2.2 Hero) */}
        <Card variant="surface" radius="hero" style={styles.heroCard}>
          <View style={[styles.heroImageContainer, { backgroundColor: colors.background.secondary }]}>
            <Image
              source={heroDrumImg}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityLabel="Acoustic Drum Kit Hero"
            />
            <View style={styles.heroGradientOverlay} />
            <View style={styles.heroPillContainer}>
              <View style={[styles.heroPill, { backgroundColor: isDark ? 'rgba(17, 23, 34, 0.90)' : 'rgba(255, 255, 255, 0.95)', borderColor: colors.border.subtle }]}>
                <Text style={[styles.heroPillText, { color: colors.accent.primary }]}>START LEARNING</Text>
              </View>
            </View>
          </View>

          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, { color: colors.text.primary }]}>Learn to Play Music</Text>
            <Text style={[styles.heroBody, { color: colors.text.secondary }]}>
              Feel professionally demonstrated rhythms, study their visual patterns, practise on a real acoustic drum kit and improve through visual performance feedback.
            </Text>
            <Button
              label="Explore Lessons"
              onPress={() => router.push('/learn/select' as any)}
              variant="primary"
              style={styles.heroButton}
            />
          </View>
        </Card>

        {/* 3. Secondary Feature Card: Experience Music (Player Gateway) */}
        <Card variant="surface" radius="large" style={styles.secondaryFeatureCard}>
          <View style={styles.secondaryRow}>
            <View style={[styles.secondaryThumbBox, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
              <Image source={spheresArtwork} style={styles.secondaryThumbImg} resizeMode="cover" />
            </View>
            <View style={styles.secondaryTextCol}>
              <Text style={[styles.secondaryTitle, { color: colors.text.primary }]}>Experience Music</Text>
              <Text style={[styles.secondaryBody, { color: colors.text.secondary }]}>
                Experience music through synchronized visuals, lyrics where available, and tactile rhythm feedback.
              </Text>
            </View>
          </View>

          <Button
            label="Open Music Player"
            onPress={() => router.push('/player' as any)}
            variant="secondary"
            style={styles.secondaryButton}
          />
        </Card>

        {/* 4. Continue Learning (Honest State) */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionHeading, { color: colors.text.primary }]}>Continue Learning</Text>
          <Card variant="surface" radius="large" style={styles.continueCard}>
            <View style={styles.continueRow}>
              <View style={[styles.continueIconCircle, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}>
                <Text style={[styles.continueEmoji, { color: colors.accent.secondary }]}>🎵</Text>
              </View>
              <View style={styles.continueTextCol}>
                <Text style={[styles.continueTitle, { color: colors.text.primary }]}>
                  {lastEvaluation ? `Last: ${activePattern.title}` : 'No active lesson yet'}
                </Text>
                <Text style={[styles.continueBody, { color: colors.text.secondary }]}>
                  {lastEvaluation
                    ? `Previous timing score: ${Math.round(lastEvaluation.timingScore)}%. Tap below to continue physical practice.`
                    : 'Your current lesson will appear here once you begin. Pick a groove below to start your first session.'}
                </Text>
              </View>
            </View>
            {lastEvaluation ? (
              <Button
                label="Resume Practice"
                onPress={() => router.push('/learn/practice')}
                variant="primary"
                style={styles.resumeButton}
              />
            ) : null}
          </Card>
        </View>

        {/* 5. Featured Lessons */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.text.primary }]}>Featured Lessons</Text>
            <TouchableOpacity
              onPress={() => router.push('/learn/select' as any)}
              accessibilityRole="button"
              accessibilityLabel="Browse All Lessons"
            >
              <Text style={[styles.sectionActionText, { color: colors.accent.primary }]}>Browse All Lessons →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.lessonsList}>
            {/* Lesson 1 */}
            <TouchableOpacity
              style={[styles.lessonCard, { backgroundColor: colors.background.surface, borderColor: colors.border.subtle }]}
              onPress={() => {
                router.push('/learn/practice');
              }}
              activeOpacity={0.8}
            >
              <Image source={rockGrooveThumb} style={styles.lessonThumb} resizeMode="cover" />
              <View style={styles.lessonInfo}>
                <View style={styles.lessonPillRow}>
                  <Text style={[styles.lessonBadge, { backgroundColor: colors.accent.primary, color: '#FFFFFF' }]}>STARTER</Text>
                  <Text style={[styles.lessonMeta, { color: colors.text.secondary }]}>104 BPM • 4/4</Text>
                </View>
                <Text style={[styles.lessonTitle, { color: colors.text.primary }]}>Rock Foundation Groove</Text>
                <Text style={[styles.lessonSub, { color: colors.text.secondary }]}>
                  Acoustic Drum Kit • Kick, snare and steady eighth-note hi-hat.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Lesson 2 */}
            <TouchableOpacity
              style={[styles.lessonCard, { backgroundColor: colors.background.surface, borderColor: colors.border.subtle }]}
              onPress={() => {
                router.push('/learn/practice');
              }}
              activeOpacity={0.8}
            >
              <Image source={kickSnareThumb} style={styles.lessonThumb} resizeMode="cover" />
              <View style={styles.lessonInfo}>
                <View style={styles.lessonPillRow}>
                  <Text style={[styles.lessonBadge, { backgroundColor: colors.accent.secondary, color: '#FFFFFF' }]}>INTERMEDIATE</Text>
                  <Text style={[styles.lessonMeta, { color: colors.text.secondary }]}>90 BPM • 4/4</Text>
                </View>
                <Text style={[styles.lessonTitle, { color: colors.text.primary }]}>Basic Kick and Snare</Text>
                <Text style={[styles.lessonSub, { color: colors.text.secondary }]}>
                  Acoustic Kit Pattern • Downbeat kick and backbeat snare sync.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Lesson 3 */}
            <TouchableOpacity
              style={[styles.lessonCard, { backgroundColor: colors.background.surface, borderColor: colors.border.subtle }]}
              onPress={() => {
                router.push('/learn/practice');
              }}
              activeOpacity={0.8}
            >
              <Image source={hiHatThumb} style={styles.lessonThumb} resizeMode="cover" />
              <View style={styles.lessonInfo}>
                <View style={styles.lessonPillRow}>
                  <Text style={[styles.lessonBadge, { backgroundColor: colors.background.elevated, color: colors.text.primary }]}>RHYTHM</Text>
                  <Text style={[styles.lessonMeta, { color: colors.text.secondary }]}>110 BPM • 4/4</Text>
                </View>
                <Text style={[styles.lessonTitle, { color: colors.text.primary }]}>Hi-Hat Rhythm Fundamentals</Text>
                <Text style={[styles.lessonSub, { color: colors.text.secondary }]}>
                  Subdivision Focus • Consistent right-hand cymbal pulse.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. Professional Demonstrations */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.text.primary }]}>Professional Demonstrations</Text>
            <View style={[styles.demoPill, { backgroundColor: 'rgba(21, 158, 152, 0.15)' }]}>
              <Text style={[styles.demoPillText, { color: colors.accent.secondary }]}>WATCH & FEEL</Text>
            </View>
          </View>

          <Card variant="surface" radius="large" style={styles.demoCard}>
            <View style={[styles.demoImageContainer, { backgroundColor: colors.background.secondary }]}>
              <Image
                source={drummerThumb}
                style={styles.demoImage}
                resizeMode="cover"
                accessibilityLabel="Professional Drummer Demonstration"
              />
              <View style={styles.demoOverlay} />
              <View style={styles.playCenterCircle}>
                <Text style={styles.playCenterIcon}>▶</Text>
              </View>
            </View>
            <View style={styles.demoContent}>
              <Text style={[styles.demoTitle, { color: colors.text.primary }]}>
                Acoustic Kit Masterclass Groove
              </Text>
              <Text style={[styles.demoDescription, { color: colors.text.secondary }]}>
                Watch professional drummer stick control, kick pedal mechanics and dynamic snare accents on a full acoustic kit.
              </Text>
              <Text style={[styles.demoCredit, { color: colors.text.secondary }]}>
                Visual study reference • Professional educational demonstration.
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* 7. Approved Bottom Navigation */}
      <BottomNavigation activeTab="academy" />
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
    paddingBottom: 24,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flex: 1,
  },
  backExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  backExploreArrow: {
    fontSize: 14,
    fontWeight: '700',
  },
  backExploreLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  brandTextCol: {
    flex: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIconMini: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: 11,
  },
  brandSuperTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerSub: {
    fontSize: 13,
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
  heroCard: {
    marginBottom: 20,
    padding: 0,
    overflow: 'hidden',
  },
  heroImageContainer: {
    width: '100%',
    aspectRatio: 16 / 10,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  heroPillContainer: {
    position: 'absolute',
    top: 14,
    left: 14,
  },
  heroPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroContent: {
    padding: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  heroButton: {
    minHeight: 52,
  },
  secondaryFeatureCard: {
    marginBottom: 24,
    padding: 16,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  secondaryThumbBox: {
    width: 70,
    height: 70,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  secondaryThumbImg: {
    width: '100%',
    height: '100%',
  },
  secondaryTextCol: {
    flex: 1,
  },
  secondaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  secondaryBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryButton: {
    minHeight: 46,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  continueCard: {
    padding: 16,
    marginTop: 8,
  },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  continueIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueEmoji: {
    fontSize: 20,
  },
  continueTextCol: {
    flex: 1,
  },
  continueTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  continueBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  resumeButton: {
    marginTop: 14,
    minHeight: 44,
  },
  lessonsList: {
    flexDirection: 'column',
    gap: 12,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  lessonThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  lessonBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  lessonMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  lessonSub: {
    fontSize: 12,
    marginTop: 2,
  },
  demoPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  demoPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  demoCard: {
    padding: 0,
    overflow: 'hidden',
  },
  demoImageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
  },
  demoImage: {
    width: '100%',
    height: '100%',
  },
  demoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  playCenterCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCenterIcon: {
    fontSize: 18,
    color: '#202638',
    marginLeft: 3,
  },
  demoContent: {
    padding: 16,
  },
  demoTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  demoDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  demoCredit: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});
