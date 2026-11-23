import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme';
import { Card, BottomNavigation } from '@/components/common';
import { useLearningSession } from '@/features/learning';

export default function ProgressV1Screen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { lastEvaluation, activePattern } = useLearningSession();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      {/* 1. Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconBox, { backgroundColor: colors.accent.primary }]}>
            <Text style={styles.headerIconText}>📊</Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Progress</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerCircleBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
            onPress={() => router.push('/settings')}
            accessibilityLabel="Sensory Settings"
          >
            <Text style={styles.headerCircleIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION A: Your Progress */}
        <Card variant="surface" radius="hero" style={styles.progressFocalCard}>
          {/* Category Pill */}
          <View style={[styles.categoryPill, { backgroundColor: colors.background.secondary }]}>
            <Text style={[styles.categoryIcon, { color: colors.accent.primary }]}>🥁</Text>
            <Text style={[styles.categoryText, { color: colors.text.secondary }]}>
              DRUM FUNDAMENTALS
            </Text>
          </View>

          {/* Circular Progress Ring */}
          <View style={[styles.ringContainer, { borderColor: colors.accent.secondary }]}>
            <Text style={[styles.ringPercent, { color: colors.text.primary }]}>
              {lastEvaluation ? `${Math.round(lastEvaluation.overallAccuracy)}%` : '0%'}
            </Text>
            <Text style={[styles.ringSub, { color: colors.text.secondary }]}>
              {lastEvaluation ? '1 of 16 lessons' : '0 of 16 lessons'}
            </Text>
          </View>

          <Text style={[styles.encouragementText, { color: colors.text.secondary }]}>
            {lastEvaluation
              ? 'You’re making steady, rhythmic progress.'
              : 'No completed lessons yet. Start your rhythmic journey in the Academy.'}
          </Text>
        </Card>

        {/* SECTION B: Recent Practice */}
        <View style={styles.sectionBox}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              RECENT PRACTICE
            </Text>
            {lastEvaluation && (
              <View style={styles.syncedPill}>
                <View style={[styles.syncedDot, { backgroundColor: colors.accent.secondary }]} />
                <Text style={[styles.syncedText, { color: colors.accent.secondary }]}>Synced</Text>
              </View>
            )}
          </View>

          {lastEvaluation ? (
            <TouchableOpacity
              style={[styles.recentCard, { backgroundColor: colors.background.surface, borderColor: colors.border.subtle }]}
              onPress={() => router.push('/learn/results')}
              activeOpacity={0.8}
            >
              <View style={[styles.recentIconBox, { backgroundColor: 'rgba(70, 87, 213, 0.12)' }]}>
                <Text style={{ fontSize: 20 }}>🥁</Text>
              </View>
              <View style={styles.recentInfo}>
                <Text style={[styles.recentTitle, { color: colors.text.primary }]}>
                  {activePattern.title} — Practice Take
                </Text>
                <Text style={[styles.recentMeta, { color: colors.text.secondary }]}>
                  Timing: ±{Math.round(lastEvaluation.averageOffsetMs)}ms • Accuracy: {Math.round(lastEvaluation.overallAccuracy)}%
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.text.secondary }]}>›</Text>
            </TouchableOpacity>
          ) : (
            <Card variant="surface" radius="default" style={styles.emptyRecentCard}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>📝</Text>
              <Text style={[styles.emptyRecentTitle, { color: colors.text.primary }]}>
                No Practice Sessions Recorded
              </Text>
              <Text style={[styles.emptyRecentBody, { color: colors.text.secondary }]}>
                Complete an acoustic groove take in the Physical Practice Studio to track your timing accuracy and progress metrics here.
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, { backgroundColor: colors.background.elevated, borderColor: colors.border.subtle }]}
                onPress={() => router.push('/learn')}
              >
                <Text style={[styles.emptyActionText, { color: colors.accent.primary }]}>
                  Go to Academy Lessons →
                </Text>
              </TouchableOpacity>
            </Card>
          )}
        </View>

        {/* SECTION C: Continue Learning */}
        <View style={styles.sectionBox}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary, marginBottom: 10 }]}>
            CONTINUE LEARNING
          </Text>

          <Card variant="surface" radius="large" style={styles.upNextCard}>
            <View style={[styles.upNextBadge, { backgroundColor: 'rgba(21, 158, 152, 0.15)' }]}>
              <Text style={[styles.upNextBadgeText, { color: colors.accent.secondary }]}>UP NEXT</Text>
            </View>
            <Text style={[styles.upNextTitle, { color: colors.text.primary }]}>
              {lastEvaluation ? 'Basic Kick and Snare' : 'Rock Foundation Groove'}
            </Text>
            <Text style={[styles.upNextMeta, { color: colors.text.secondary }]}>
              {lastEvaluation
                ? 'Lesson 2 • 90 BPM • Essential Pocket Isolation'
                : 'Lesson 1 • 104 BPM • 4/4 Acoustic Kit Foundation'}
            </Text>
            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: colors.accent.primary }]}
              onPress={() => router.push('/learn/practice')}
              activeOpacity={0.8}
            >
              <Text style={styles.continueBtnText}>
                {lastEvaluation ? 'Start Next Lesson →' : 'Start Lesson 1 →'}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab="progress" />
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  headerRight: {},
  headerCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCircleIcon: {
    fontSize: 18,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  progressFocalCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  categoryIcon: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  ringContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  ringPercent: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  ringSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  encouragementText: {
    fontSize: 14,
    marginTop: 14,
    textAlign: 'center',
  },
  sectionBox: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  syncedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  emptyRecentCard: {
    padding: 20,
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyRecentTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyRecentBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  recentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInfo: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  recentMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '700',
  },
  upNextCard: {
    padding: 18,
  },
  upNextBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  upNextBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  upNextTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  upNextMeta: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  continueBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
