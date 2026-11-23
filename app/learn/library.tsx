import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme';
import { Card, BottomNavigation } from '@/components/common';

const rockGrooveThumb = require('../../assets/images/lessons/rock-foundation-groove.jpg');
const kickSnareThumb = require('../../assets/images/lessons/kick-snare-card.jpg');
const hiHatThumb = require('../../assets/images/lessons/hi-hat-fundamentals.jpg');
const drummerThumb = require('../../assets/images/demonstrations/professional-drummer.jpg');

export default function ReferenceLibraryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();

  const [activeTab, setActiveTab] = useState<'ready' | 'preparation' | 'pending'>('ready');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      {/* 1. Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}
          onPress={() => router.push('/learn')}
          accessibilityLabel="Back to Academy Home"
          accessibilityRole="button"
        >
          <Text style={[styles.backIcon, { color: colors.text.primary }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Reference Library</Text>
          <Text style={[styles.headerSub, { color: colors.text.secondary }]}>
            Curated Drum Grooves & Video Demonstrations
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: colors.background.secondary, borderColor: colors.border.subtle }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Search grooves, tempos, time signatures..."
            placeholderTextColor={colors.text.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* 2. Filter Tabs: Ready to Learn, Under Preparation, Pending Review */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              {
                backgroundColor: activeTab === 'ready' ? colors.accent.primary : colors.background.elevated,
                borderColor: activeTab === 'ready' ? 'transparent' : colors.border.subtle,
              },
            ]}
            onPress={() => setActiveTab('ready')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'ready' ? '#FFFFFF' : colors.text.primary }]}>
              Ready to Learn (3)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              {
                backgroundColor: activeTab === 'preparation' ? colors.accent.primary : colors.background.elevated,
                borderColor: activeTab === 'preparation' ? 'transparent' : colors.border.subtle,
              },
            ]}
            onPress={() => setActiveTab('preparation')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'preparation' ? '#FFFFFF' : colors.text.primary }]}>
              Preparation (2)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              {
                backgroundColor: activeTab === 'pending' ? colors.accent.primary : colors.background.elevated,
                borderColor: activeTab === 'pending' ? 'transparent' : colors.border.subtle,
              },
            ]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'pending' ? '#FFFFFF' : colors.text.primary }]}>
              Pending Review (1)
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. Tab Content */}
        {activeTab === 'ready' && (
          <View style={styles.contentSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.text.primary }]}>
                Graded Practice Grooves
              </Text>
              <Text style={[styles.statusTag, { color: colors.accent.secondary }]}>
                VERIFIED REFERENCE
              </Text>
            </View>

            {/* Lesson 1: Rock Foundation Groove */}
            <TouchableOpacity
              style={[styles.grooveCard, { backgroundColor: colors.background.surface, borderColor: colors.border.subtle }]}
              onPress={() => router.push('/learn/practice')}
              activeOpacity={0.8}
            >
              <Image source={rockGrooveThumb} style={styles.grooveThumb} resizeMode="cover" />
              <View style={styles.grooveDetails}>
                <View style={styles.badgeRow}>
                  <Text style={[styles.grooveBadge, { backgroundColor: colors.accent.primary, color: '#FFF' }]}>
                    READY TO LEARN
                  </Text>
                  <Text style={[styles.grooveTempo, { color: colors.text.secondary }]}>104 BPM • 4/4</Text>
                </View>
                <Text style={[styles.grooveTitle, { color: colors.text.primary }]}>
                  Rock Foundation Groove
                </Text>
                <Text style={[styles.grooveDesc, { color: colors.text.secondary }]}>
                  Acoustic Kit Pattern • Downbeat kick, backbeat snare, and steady eighth-note hi-hat.
                </Text>
                <View style={styles.actionRow}>
                  <Text style={[styles.actionLaunch, { color: colors.accent.primary }]}>
                    Launch Physical Practice →
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Lesson 2: Basic Kick and Snare */}
            <TouchableOpacity
              style={[styles.grooveCard, { backgroundColor: colors.background.surface, borderColor: colors.border.subtle }]}
              onPress={() => router.push('/learn/practice')}
              activeOpacity={0.8}
            >
              <Image source={kickSnareThumb} style={styles.grooveThumb} resizeMode="cover" />
              <View style={styles.grooveDetails}>
                <View style={styles.badgeRow}>
                  <Text style={[styles.grooveBadge, { backgroundColor: colors.accent.secondary, color: '#FFF' }]}>
                    READY TO LEARN
                  </Text>
                  <Text style={[styles.grooveTempo, { color: colors.text.secondary }]}>90 BPM • 4/4</Text>
                </View>
                <Text style={[styles.grooveTitle, { color: colors.text.primary }]}>
                  Basic Kick and Snare
                </Text>
                <Text style={[styles.grooveDesc, { color: colors.text.secondary }]}>
                  Essential Pocket • Isolation of fundamental bass drum and snare relationship.
                </Text>
                <View style={styles.actionRow}>
                  <Text style={[styles.actionLaunch, { color: colors.accent.primary }]}>
                    Launch Physical Practice →
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Lesson 3: Hi-Hat Fundamentals */}
            <TouchableOpacity
              style={[styles.grooveCard, { backgroundColor: colors.background.surface, borderColor: colors.border.subtle }]}
              onPress={() => router.push('/learn/practice')}
              activeOpacity={0.8}
            >
              <Image source={hiHatThumb} style={styles.grooveThumb} resizeMode="cover" />
              <View style={styles.grooveDetails}>
                <View style={styles.badgeRow}>
                  <Text style={[styles.grooveBadge, { backgroundColor: colors.accent.primary, color: '#FFF' }]}>
                    READY TO LEARN
                  </Text>
                  <Text style={[styles.grooveTempo, { color: colors.text.secondary }]}>110 BPM • 4/4</Text>
                </View>
                <Text style={[styles.grooveTitle, { color: colors.text.primary }]}>
                  Hi-Hat Rhythm Fundamentals
                </Text>
                <Text style={[styles.grooveDesc, { color: colors.text.secondary }]}>
                  Subdivision Focus • Even sticking dynamics and constant quarter-note pulse.
                </Text>
                <View style={styles.actionRow}>
                  <Text style={[styles.actionLaunch, { color: colors.accent.primary }]}>
                    Launch Physical Practice →
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'preparation' && (
          <View style={styles.contentSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.text.primary }]}>
                Under Preparation (Non-Graded)
              </Text>
            </View>
            <Card variant="surface" radius="large" style={styles.inactiveCard}>
              <View style={styles.inactiveBadgeBox}>
                <Text style={[styles.inactiveBadge, { backgroundColor: colors.background.elevated, color: colors.text.secondary }]}>
                  UNDER PREPARATION
                </Text>
              </View>
              <Text style={[styles.inactiveTitle, { color: colors.text.primary }]}>
                Funk Syncopated Ghost Notes
              </Text>
              <Text style={[styles.inactiveDesc, { color: colors.text.secondary }]}>
                Rhythm annotations and multi-track acoustic onset profiles are currently being verified by instructors. Graded practice will open once calibration is complete.
              </Text>
            </Card>

            <Card variant="surface" radius="large" style={styles.inactiveCard}>
              <View style={styles.inactiveBadgeBox}>
                <Text style={[styles.inactiveBadge, { backgroundColor: colors.background.elevated, color: colors.text.secondary }]}>
                  UNDER PREPARATION
                </Text>
              </View>
              <Text style={[styles.inactiveTitle, { color: colors.text.primary }]}>
                Jazz Swing Ride Cymbal Pattern
              </Text>
              <Text style={[styles.inactiveDesc, { color: colors.text.secondary }]}>
                Triplet subdivision visual alignment is undergoing evaluation testing.
              </Text>
            </Card>
          </View>
        )}

        {activeTab === 'pending' && (
          <View style={styles.contentSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.text.primary }]}>
                Pending Review (Non-Graded)
              </Text>
            </View>
            <Card variant="surface" radius="large" style={styles.inactiveCard}>
              <View style={styles.inactiveBadgeBox}>
                <Text style={[styles.inactiveBadge, { backgroundColor: colors.background.elevated, color: colors.text.secondary }]}>
                  PENDING REVIEW
                </Text>
              </View>
              <Text style={[styles.inactiveTitle, { color: colors.text.primary }]}>
                Polyrhythmic 3:2 Metric Modulation
              </Text>
              <Text style={[styles.inactiveDesc, { color: colors.text.secondary }]}>
                Submitted curriculum module awaiting tactile amplitude calibration.
              </Text>
            </Card>
          </View>
        )}

        {/* 4. Professional Video Demonstrations */}
        <View style={styles.demoSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.text.primary }]}>
              Professional Demonstrations
            </Text>
            <View style={[styles.youtubeBadge, { backgroundColor: 'rgba(21, 158, 152, 0.15)' }]}>
              <Text style={[styles.youtubeBadgeText, { color: colors.accent.secondary }]}>
                VIDEO STUDY
              </Text>
            </View>
          </View>

          <Card variant="surface" radius="large" style={styles.videoCard}>
            <View style={styles.videoThumbContainer}>
              <Image source={drummerThumb} style={styles.videoThumb} resizeMode="cover" />
              <View style={styles.videoOverlay} />
              <View style={styles.videoPlayBtn}>
                <Text style={styles.videoPlayIcon}>▶</Text>
              </View>
            </View>
            <View style={styles.videoContent}>
              <Text style={[styles.videoTitle, { color: colors.text.primary }]}>
                Acoustic Kit Masterclass Demonstration
              </Text>
              <Text style={[styles.videoDesc, { color: colors.text.secondary }]}>
                Full acoustic kit performance demonstration. Note the relaxed wrist angle and steady hi-hat motion on eighth-note subdivisions.
              </Text>
              <Text style={[styles.videoNotice, { color: colors.text.secondary }]}>
                YouTube Reference • Educational visual reference. Does not constitute an automated grading track.
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab="academy" />
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
    fontSize: 20,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  contentSection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
  },
  statusTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  grooveCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginBottom: 12,
  },
  grooveThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  grooveDetails: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  grooveBadge: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  grooveTempo: {
    fontSize: 11,
    fontWeight: '600',
  },
  grooveTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  grooveDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionLaunch: {
    fontSize: 12,
    fontWeight: '700',
  },
  inactiveCard: {
    padding: 16,
    marginBottom: 12,
  },
  inactiveBadgeBox: {
    marginBottom: 6,
  },
  inactiveBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  inactiveTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  inactiveDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  demoSection: {
    marginBottom: 20,
  },
  youtubeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  youtubeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  videoCard: {
    padding: 0,
    overflow: 'hidden',
  },
  videoThumbContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  videoPlayBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -22 }, { translateY: -22 }],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIcon: {
    fontSize: 18,
    color: '#202638',
    marginLeft: 2,
  },
  videoContent: {
    padding: 16,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  videoDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  videoNotice: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});
